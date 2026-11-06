import Foundation
import SwiftData
import SwiftUI

// MARK: - Small enums

enum PaymentDirection: String, CaseIterable, Identifiable {
    case outgoing, incoming
    var id: String { rawValue }

    var label: String { self == .outgoing ? "De plătit" : "De primit" }
    var icon: String { self == .outgoing ? "arrow.up.right.circle.fill" : "arrow.down.left.circle.fill" }
    var color: Color { self == .outgoing ? .red : .green }
}

enum ReminderRepeat: String, CaseIterable, Identifiable {
    case none, daily, weekly, monthly, yearly
    var id: String { rawValue }

    var label: String {
        switch self {
        case .none: "Niciodată"
        case .daily: "Zilnic"
        case .weekly: "Săptămânal"
        case .monthly: "Lunar"
        case .yearly: "Anual"
        }
    }
}

enum Priority: Int, CaseIterable, Identifiable {
    case normal = 0, important = 1, urgent = 2
    var id: Int { rawValue }

    var label: String {
        switch self {
        case .normal: "Normal"
        case .important: "Important"
        case .urgent: "Urgent"
        }
    }

    var color: Color {
        switch self {
        case .normal: Color.secondary
        case .important: Color.orange
        case .urgent: Color.red
        }
    }
}

let supportedCurrencies = ["RON", "EUR", "USD", "GBP"]

// MARK: - Entry (one item in a list)

@Model
final class Entry {
    var uid: UUID = UUID()
    var categoryID: UUID = UUID()
    var title: String = ""
    var details: String = ""
    var group: String = ""
    var isDone: Bool = false
    var completedAt: Date?
    var createdAt: Date = Date()

    var hasDeadline: Bool = false
    var deadline: Date = Date()
    var deadlineIncludesTime: Bool = true

    var hasAmount: Bool = false
    var amount: Double = 0
    var currency: String = "RON"
    var isPaid: Bool = false
    var directionRaw: String = PaymentDirection.outgoing.rawValue

    var vendor: String = ""
    var tracking: String = ""
    var priorityRaw: Int = 0

    var hasReminder: Bool = false
    var reminderDate: Date = Date()
    var repeatRaw: String = ReminderRepeat.none.rawValue

    init(categoryID: UUID) {
        self.uid = UUID()
        self.categoryID = categoryID
        self.createdAt = Date()
    }
}

extension Entry {
    var direction: PaymentDirection {
        get { PaymentDirection(rawValue: directionRaw) ?? .outgoing }
        set { directionRaw = newValue.rawValue }
    }

    var repeatRule: ReminderRepeat {
        get { ReminderRepeat(rawValue: repeatRaw) ?? .none }
        set { repeatRaw = newValue.rawValue }
    }

    var priority: Priority {
        get { Priority(rawValue: priorityRaw) ?? .normal }
        set { priorityRaw = newValue.rawValue }
    }

    var notificationID: String { uid.uuidString }

    var isOverdue: Bool {
        guard hasDeadline, !isDone else { return false }
        if deadlineIncludesTime { return deadline < Date() }
        return Calendar.current.startOfDay(for: deadline) < Calendar.current.startOfDay(for: Date())
    }

    var isDueToday: Bool {
        hasDeadline && !isDone && Calendar.current.isDateInToday(deadline)
    }

    var deadlineText: String {
        deadlineIncludesTime ? Fmt.dayTime(deadline) : Fmt.day(deadline)
    }

    /// Next time the reminder fires (for repeating reminders whose start date already passed).
    var nextReminderDate: Date {
        let now = Date()
        guard repeatRule != .none, reminderDate < now else { return reminderDate }
        let comps = NotificationManager.triggerComponents(for: reminderDate, rule: repeatRule)
        return Calendar.current.nextDate(after: now, matching: comps, matchingPolicy: .nextTime) ?? reminderDate
    }

    /// Reminder is in the past, not repeating and the item is still unchecked.
    var reminderMissed: Bool {
        hasReminder && !isDone && repeatRule == .none && reminderDate < Date()
    }

    /// Date used to sort / bucket the item: its deadline, otherwise its reminder.
    var sortDate: Date? {
        if hasDeadline { return deadline }
        if hasReminder { return nextReminderDate }
        return nil
    }
}

// MARK: - Draft (editing copy, so "Renunță" really discards changes)

struct EntryDraft {
    var title = ""
    var details = ""
    var group = ""
    var isDone = false
    var hasDeadline = false
    var deadline: Date
    var hasAmount = false
    var amountText = ""
    var currency = "RON"
    var isPaid = false
    var direction: PaymentDirection = .outgoing
    var vendor = ""
    var tracking = ""
    var priority: Priority = .normal
    var hasReminder = false
    var reminderDate: Date
    var repeatRule: ReminderRepeat = .none

    init(category: ListCategory) {
        let cal = Calendar.current
        let tomorrow = cal.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        let hour = category.deadlineHasTime ? 18 : 12
        deadline = cal.date(bySettingHour: hour, minute: 0, second: 0, of: tomorrow) ?? tomorrow
        let nextHour = cal.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
        reminderDate = cal.date(bySetting: .minute, value: 0, of: nextHour) ?? nextHour
        currency = category.defaultCurrency
        hasReminder = category.reminderMode == .always
        hasAmount = category.usesAmount && !category.usesPaidToggle
    }

    init(entry: Entry) {
        title = entry.title
        details = entry.details
        group = entry.group
        isDone = entry.isDone
        hasDeadline = entry.hasDeadline
        deadline = entry.deadline
        hasAmount = entry.hasAmount
        amountText = entry.amount == 0 ? "" : Fmt.plainNumber(entry.amount)
        currency = entry.currency
        isPaid = entry.isPaid
        direction = entry.direction
        vendor = entry.vendor
        tracking = entry.tracking
        priority = entry.priority
        hasReminder = entry.hasReminder
        reminderDate = entry.reminderDate
        repeatRule = entry.repeatRule
    }

    var amount: Double { Fmt.parseAmount(amountText) ?? 0 }

    var trimmedTitle: String { title.trimmingCharacters(in: .whitespacesAndNewlines) }

    func apply(to e: Entry, category: ListCategory) {
        e.categoryID = category.uid
        e.title = trimmedTitle
        e.details = details.trimmingCharacters(in: .whitespacesAndNewlines)
        e.group = category.usesGroups ? group.trimmingCharacters(in: .whitespacesAndNewlines) : e.group
        if isDone != e.isDone { e.completedAt = isDone ? Date() : nil }
        e.isDone = isDone
        e.hasDeadline = category.usesDeadline && hasDeadline
        e.deadline = deadline
        e.deadlineIncludesTime = category.deadlineHasTime
        e.hasAmount = category.usesAmount && (hasAmount || amount > 0)
        e.amount = amount
        e.currency = currency
        e.isPaid = isPaid
        e.direction = direction
        e.vendor = vendor.trimmingCharacters(in: .whitespacesAndNewlines)
        e.tracking = tracking.trimmingCharacters(in: .whitespacesAndNewlines)
        e.priority = category.usesPriority ? priority : .normal
        switch category.reminderMode {
        case .off: e.hasReminder = false
        case .optional: e.hasReminder = hasReminder
        case .always: e.hasReminder = true
        }
        e.reminderDate = reminderDate
        e.repeatRule = repeatRule
    }
}
