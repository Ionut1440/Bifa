import Foundation
import SwiftData
import SwiftUI

enum ReminderMode: String, CaseIterable, Identifiable {
    case off, optional, always
    var id: String { rawValue }

    var label: String {
        switch self {
        case .off: "Fără remindere"
        case .optional: "Opțional, la fiecare element"
        case .always: "Fiecare element e un reminder"
        }
    }
}

enum GroupMode: String, CaseIterable, Identifiable {
    case date, group, none
    var id: String { rawValue }

    var label: String {
        switch self {
        case .date: "După dată"
        case .group: "După grup"
        case .none: "Fără grupare"
        }
    }

    var icon: String {
        switch self {
        case .date: "calendar"
        case .group: "folder"
        case .none: "list.bullet"
        }
    }
}

/// A user-editable list ("Comenzi", "Plăți", …). Its flags are the "rules":
/// which fields its items have and how reminders / cleanup behave.
@Model
final class ListCategory {
    var uid: UUID = UUID()
    var name: String = ""
    var icon: String = "folder.fill"
    var colorIndex: Int = 0
    var sortOrder: Int = 0
    var createdAt: Date = Date()
    var titlePlaceholder: String = "Titlu"

    // Fields
    var usesDeadline: Bool = true
    var deadlineLabel: String = "Termen limită"
    var deadlineHasTime: Bool = true
    var usesAmount: Bool = false
    var defaultCurrency: String = "RON"
    var usesPaidToggle: Bool = false
    var usesDirection: Bool = false
    var usesVendor: Bool = false
    var vendorLabel: String = "Persoană / magazin"
    var usesTracking: Bool = false
    var trackingLabel: String = "Cod / AWB"
    var usesPriority: Bool = false
    var usesGroups: Bool = false
    var doneLabel: String = "Bifat"

    // Sub-items (e.g. products of an order)
    var usesSubitems: Bool = false
    var subitemLabel: String = "Sub-elemente"
    var autoCompleteFromSubitems: Bool = true

    // Reminders
    var reminderModeRaw: String = ReminderMode.optional.rawValue
    var autoReminder: Bool = false
    var autoReminderDaysBefore: Int = 1
    var autoReminderMinutes: Int = 9 * 60

    // Display & cleanup
    var groupModeRaw: String = GroupMode.date.rawValue
    var showSummary: Bool = true
    var autoDeleteDoneDays: Int = 0

    init(name: String) {
        self.uid = UUID()
        self.name = name
        self.createdAt = Date()
    }
}

extension ListCategory {
    var reminderMode: ReminderMode {
        get { ReminderMode(rawValue: reminderModeRaw) ?? .optional }
        set { reminderModeRaw = newValue.rawValue }
    }

    var groupMode: GroupMode {
        get { GroupMode(rawValue: groupModeRaw) ?? .date }
        set { groupModeRaw = newValue.rawValue }
    }

    var color: Color { Palette.color(colorIndex) }

    /// Copies every user-visible setting (look + rules), used by the rules editor draft.
    func copySettings(from o: ListCategory) {
        name = o.name; icon = o.icon; colorIndex = o.colorIndex; titlePlaceholder = o.titlePlaceholder
        usesDeadline = o.usesDeadline; deadlineLabel = o.deadlineLabel; deadlineHasTime = o.deadlineHasTime
        usesAmount = o.usesAmount; defaultCurrency = o.defaultCurrency
        usesPaidToggle = o.usesPaidToggle; usesDirection = o.usesDirection
        usesVendor = o.usesVendor; vendorLabel = o.vendorLabel
        usesTracking = o.usesTracking; trackingLabel = o.trackingLabel
        usesPriority = o.usesPriority; usesGroups = o.usesGroups; doneLabel = o.doneLabel
        usesSubitems = o.usesSubitems; subitemLabel = o.subitemLabel
        autoCompleteFromSubitems = o.autoCompleteFromSubitems
        reminderModeRaw = o.reminderModeRaw; autoReminder = o.autoReminder
        autoReminderDaysBefore = o.autoReminderDaysBefore; autoReminderMinutes = o.autoReminderMinutes
        groupModeRaw = o.groupModeRaw; showSummary = o.showSummary; autoDeleteDoneDays = o.autoDeleteDoneDays
    }

    /// Reminder date suggested by the "auto reminder" rule for a given deadline.
    func autoReminderDate(for deadline: Date) -> Date {
        let cal = Calendar.current
        let day = cal.date(byAdding: .day, value: -autoReminderDaysBefore, to: deadline) ?? deadline
        let h = autoReminderMinutes / 60
        let m = autoReminderMinutes % 60
        return cal.date(bySettingHour: h, minute: m, second: 0, of: day) ?? day
    }
}

// MARK: - Palette & icons

enum Palette {
    static let colors: [Color] = [
        Color(red: 0.36, green: 0.42, blue: 0.98),  // albastru
        Color(red: 1.00, green: 0.55, blue: 0.25),  // portocaliu
        Color(red: 0.18, green: 0.72, blue: 0.48),  // verde
        Color(red: 0.95, green: 0.70, blue: 0.10),  // galben
        Color(red: 0.93, green: 0.33, blue: 0.55),  // roz
        Color(red: 0.60, green: 0.38, blue: 0.95),  // mov
        Color(red: 0.10, green: 0.70, blue: 0.80),  // turcoaz
        Color(red: 0.92, green: 0.26, blue: 0.24),  // roșu
        Color(red: 0.55, green: 0.42, blue: 0.30),  // maro
        Color(red: 0.45, green: 0.50, blue: 0.58),  // gri
    ]

    static func color(_ i: Int) -> Color { colors[((i % colors.count) + colors.count) % colors.count] }

    static let icons: [String] = [
        "checklist", "shippingbox.fill", "creditcard.fill", "note.text", "bell.fill",
        "cart.fill", "bag.fill", "house.fill", "briefcase.fill", "heart.fill",
        "star.fill", "gift.fill", "car.fill", "airplane", "fork.knife",
        "cross.case.fill", "pills.fill", "book.fill", "graduationcap.fill", "dumbbell.fill",
        "pawprint.fill", "leaf.fill", "wrench.and.screwdriver.fill", "hammer.fill", "doc.text.fill",
        "calendar", "banknote.fill", "building.columns.fill", "person.2.fill", "phone.fill",
        "lightbulb.fill", "tag.fill", "folder.fill", "music.note", "gamecontroller.fill",
        "tshirt.fill",
    ]
}

// MARK: - Templates (the built-in presets, also offered when creating a new list)

enum CategoryTemplate: String, CaseIterable, Identifiable {
    case task, order, payment, note, reminder, blank
    var id: String { rawValue }

    var label: String {
        switch self {
        case .task: "De făcut"
        case .order: "Comenzi"
        case .payment: "Plăți"
        case .note: "Notițe"
        case .reminder: "Remindere"
        case .blank: "Listă simplă"
        }
    }

    var icon: String {
        switch self {
        case .task: "checklist"
        case .order: "shippingbox.fill"
        case .payment: "creditcard.fill"
        case .note: "note.text"
        case .reminder: "bell.fill"
        case .blank: "list.bullet"
        }
    }

    /// Copies this template's rules onto a category (name/icon/color only if `includeLook`).
    func apply(to c: ListCategory, includeLook: Bool) {
        // reset to neutral first
        c.usesDeadline = true; c.deadlineLabel = "Termen limită"; c.deadlineHasTime = true
        c.usesAmount = false; c.usesPaidToggle = false; c.usesDirection = false
        c.usesVendor = false; c.vendorLabel = "Persoană / magazin"
        c.usesTracking = false; c.trackingLabel = "Cod / AWB"
        c.usesPriority = false; c.usesGroups = false
        c.doneLabel = "Bifat"; c.titlePlaceholder = "Titlu"
        c.usesSubitems = false; c.subitemLabel = "Sub-elemente"; c.autoCompleteFromSubitems = true
        c.reminderMode = .optional; c.autoReminder = false
        c.autoReminderDaysBefore = 1; c.autoReminderMinutes = 9 * 60
        c.groupMode = .date; c.showSummary = true; c.autoDeleteDoneDays = 0

        switch self {
        case .task:
            c.usesPriority = true; c.usesGroups = true
            c.usesSubitems = true; c.subitemLabel = "Pași"
            c.doneLabel = "Făcut"; c.titlePlaceholder = "Ce ai de făcut?"
        case .order:
            c.deadlineLabel = "Livrare estimată"; c.deadlineHasTime = false
            c.usesAmount = true; c.usesPaidToggle = true
            c.usesVendor = true; c.vendorLabel = "Magazin / curier"
            c.usesTracking = true; c.trackingLabel = "AWB / nr. comandă"
            c.usesSubitems = true; c.subitemLabel = "Produse"
            c.doneLabel = "Primită"; c.titlePlaceholder = "Ce ai comandat? (ex: eMAG, Zara)"
        case .payment:
            c.deadlineLabel = "Scadență"; c.deadlineHasTime = false
            c.usesAmount = true; c.usesDirection = true
            c.usesVendor = true; c.vendorLabel = "Către / de la cine"
            c.autoReminder = true; c.autoReminderDaysBefore = 1
            c.doneLabel = "Achitată"; c.titlePlaceholder = "Pentru ce e plata?"
        case .note:
            c.usesGroups = true; c.groupMode = .group
            c.titlePlaceholder = "Titlu notiță"
        case .reminder:
            c.usesDeadline = false; c.reminderMode = .always
            c.doneLabel = "Gata"; c.titlePlaceholder = "Ce să-ți amintesc?"
        case .blank:
            c.usesDeadline = false; c.groupMode = .none
        }

        if includeLook {
            c.name = label
            c.icon = icon
            c.colorIndex = switch self {
            case .task: 0
            case .order: 1
            case .payment: 2
            case .note: 3
            case .reminder: 4
            case .blank: 5
            }
        }
    }

    static let builtIn: [CategoryTemplate] = [.task, .order, .payment, .note, .reminder]

    /// Inserts the default lists the very first time the app runs.
    static func seedIfNeeded(_ context: ModelContext) {
        let key = "didSeedCategories"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        let existing = (try? context.fetchCount(FetchDescriptor<ListCategory>())) ?? 0
        if existing == 0 {
            for (i, t) in builtIn.enumerated() {
                let c = ListCategory(name: t.label)
                t.apply(to: c, includeLook: true)
                c.sortOrder = i
                context.insert(c)
            }
            try? context.save()
        }
        UserDefaults.standard.set(true, forKey: key)
    }
}
