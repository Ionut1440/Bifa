import Foundation
import SwiftData
import UserNotifications

/// Schedules local notifications for entries and handles the actions
/// ("Bifează", "Amână 10 min", "Amână 1 oră") from the notification itself.
final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()

    private let center = UNUserNotificationCenter.current()
    private var container: ModelContainer?

    private static let categoryID = "ENTRY"
    private static let actionDone = "DONE"
    private static let actionSnooze10 = "SNOOZE10"
    private static let actionSnooze60 = "SNOOZE60"

    func configure(container: ModelContainer) {
        self.container = container
        center.delegate = self

        let done = UNNotificationAction(identifier: Self.actionDone, title: "Bifează ✓", options: [])
        let snooze10 = UNNotificationAction(identifier: Self.actionSnooze10, title: "Amână 10 min", options: [])
        let snooze60 = UNNotificationAction(identifier: Self.actionSnooze60, title: "Amână 1 oră", options: [])
        let category = UNNotificationCategory(
            identifier: Self.categoryID,
            actions: [done, snooze10, snooze60],
            intentIdentifiers: [],
            options: []
        )
        center.setNotificationCategories([category])
    }

    // MARK: Permission

    func requestAuthorization() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    // MARK: Scheduling

    static func triggerComponents(for date: Date, rule: ReminderRepeat) -> DateComponents {
        let cal = Calendar.current
        switch rule {
        case .none: return cal.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        case .daily: return cal.dateComponents([.hour, .minute], from: date)
        case .weekly: return cal.dateComponents([.weekday, .hour, .minute], from: date)
        case .monthly: return cal.dateComponents([.day, .hour, .minute], from: date)
        case .yearly: return cal.dateComponents([.month, .day, .hour, .minute], from: date)
        }
    }

    /// Makes the pending notification match the entry's current state.
    func sync(_ entry: Entry, category: ListCategory?, clearSnooze: Bool = true) {
        let id = entry.notificationID
        var toRemove = [id]
        if clearSnooze { toRemove.append(id + ".snooze") }
        center.removePendingNotificationRequests(withIdentifiers: toRemove)

        guard entry.hasReminder, !entry.isDone else { return }
        let rule = entry.repeatRule
        if rule == .none && entry.reminderDate <= Date() { return }

        let trigger = UNCalendarNotificationTrigger(
            dateMatching: Self.triggerComponents(for: entry.reminderDate, rule: rule),
            repeats: rule != .none
        )
        let request = UNNotificationRequest(identifier: id,
                                            content: makeContent(for: entry, category: category),
                                            trigger: trigger)
        center.add(request, withCompletionHandler: nil)
    }

    func cancel(_ entry: Entry) {
        let id = entry.notificationID
        center.removePendingNotificationRequests(withIdentifiers: [id, id + ".snooze"])
        center.removeDeliveredNotifications(withIdentifiers: [id, id + ".snooze"])
    }

    /// Called at launch so reminders survive reinstall / restore.
    func resyncAll(_ entries: [Entry], categories: [ListCategory]) {
        let byID = Dictionary(categories.map { ($0.uid, $0) }, uniquingKeysWith: { a, _ in a })
        for e in entries where e.hasReminder {
            sync(e, category: byID[e.categoryID], clearSnooze: false)
        }
    }

    private func makeContent(for entry: Entry, category: ListCategory?) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = entry.title
        var subtitle = category?.name ?? "Bifă"
        if !entry.vendor.isEmpty { subtitle += " · \(entry.vendor)" }
        content.subtitle = subtitle

        var lines: [String] = []
        if !entry.details.isEmpty { lines.append(entry.details) }
        if entry.hasAmount && entry.amount > 0 {
            var line = Fmt.money(entry.amount, entry.currency)
            if category?.usesDirection == true { line = "\(entry.direction.label): \(line)" }
            if category?.usesPaidToggle == true { line += entry.isPaid ? " (plătit)" : " (neplătit)" }
            lines.append(line)
        }
        if entry.hasDeadline {
            lines.append("\(category?.deadlineLabel ?? "Termen"): \(entry.deadlineText)")
        }
        content.body = lines.isEmpty ? "Ți-ai cerut să-ți amintesc 🔔" : lines.joined(separator: "\n")
        content.sound = .default
        content.categoryIdentifier = Self.categoryID
        content.threadIdentifier = entry.categoryID.uuidString
        content.userInfo = ["id": entry.notificationID]
        return content
    }

    private func snooze(_ content: UNNotificationContent, id: String, minutes: Double) {
        guard let copy = content.mutableCopy() as? UNMutableNotificationContent else { return }
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: minutes * 60, repeats: false)
        center.add(UNNotificationRequest(identifier: id + ".snooze", content: copy, trigger: trigger),
                   withCompletionHandler: nil)
    }

    @MainActor
    private func markDone(_ idString: String) {
        guard let container, let uuid = UUID(uuidString: idString) else { return }
        let context = container.mainContext
        let descriptor = FetchDescriptor<Entry>(predicate: #Predicate { $0.uid == uuid })
        guard let entry = try? context.fetch(descriptor).first else { return }
        // A repeating reminder keeps going; "Bifează" only dismisses this occurrence.
        guard entry.repeatRule == .none else { return }
        entry.isDone = true
        entry.completedAt = Date()
        try? context.save()
        cancel(entry)
    }

    // MARK: UNUserNotificationCenterDelegate

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .list])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let request = response.notification.request
        let idString = (request.content.userInfo["id"] as? String)
            ?? request.identifier.replacingOccurrences(of: ".snooze", with: "")

        switch response.actionIdentifier {
        case Self.actionSnooze10:
            snooze(request.content, id: idString, minutes: 10)
            completionHandler()
        case Self.actionSnooze60:
            snooze(request.content, id: idString, minutes: 60)
            completionHandler()
        case Self.actionDone:
            Task { @MainActor in
                self.markDone(idString)
                completionHandler()
            }
        default:
            completionHandler()
        }
    }
}
