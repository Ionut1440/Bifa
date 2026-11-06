import SwiftUI
import SwiftData
import UserNotifications

struct EntryEditor: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \ListCategory.sortOrder) private var categories: [ListCategory]
    @Query private var allEntries: [Entry]

    let entry: Entry?
    @State private var category: ListCategory
    @State private var d: EntryDraft
    @State private var subs: [SubItemDraft] = []
    @State private var newSub = ""
    @State private var loadedSubs = false
    @State private var reminderTouched: Bool
    @State private var confirmDelete = false
    @State private var notificationsDenied = false
    @FocusState private var titleFocused: Bool
    @FocusState private var newSubFocused: Bool

    init(category: ListCategory, entry: Entry? = nil) {
        self.entry = entry
        _category = State(initialValue: category)
        _d = State(initialValue: entry.map { EntryDraft(entry: $0) } ?? EntryDraft(category: category))
        _reminderTouched = State(initialValue: entry?.hasReminder ?? false)
    }

    private var groups: [String] {
        let cid = category.uid
        let names = Set(allEntries.filter { $0.categoryID == cid && !$0.group.isEmpty }.map(\.group))
        return names.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(category.titlePlaceholder, text: $d.title, axis: .vertical)
                        .font(.headline)
                        .focused($titleFocused)
                    TextField("Detalii (opțional)", text: $d.details, axis: .vertical)
                        .lineLimit(1...8)
                }

                if categories.count > 1 {
                    Section {
                        Picker(selection: $category) {
                            ForEach(categories) { c in
                                Label(c.name, systemImage: c.icon).tag(c)
                            }
                        } label: {
                            Label("Listă", systemImage: "tray.full")
                        }
                    }
                }

                if category.reminderMode == .always { reminderSection }

                if category.usesSubitems { subitemsSection }

                if category.usesDirection || category.usesVendor || category.usesTracking || category.usesAmount {
                    detailsSection
                }

                if category.usesPriority || category.usesGroups { organizeSection }

                if category.usesDeadline {
                    Section {
                        Toggle(isOn: $d.hasDeadline.animation()) {
                            Label(category.deadlineLabel, systemImage: "calendar")
                        }
                        if d.hasDeadline {
                            DatePicker("Data",
                                       selection: $d.deadline,
                                       displayedComponents: category.deadlineHasTime ? [.date, .hourAndMinute] : [.date])
                        }
                    }
                }

                if category.reminderMode == .optional { reminderSection }

                if entry != nil {
                    Section {
                        Toggle(isOn: $d.isDone) {
                            Label(category.doneLabel, systemImage: "checkmark.circle")
                        }
                        Button(role: .destructive) { confirmDelete = true } label: {
                            Label("Șterge", systemImage: "trash")
                        }
                    }
                }
            }
            .navigationTitle(entry == nil ? "Nou în \(category.name)" : "Editează")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Renunță") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvează") { save() }
                        .fontWeight(.semibold)
                        .disabled(d.trimmedTitle.isEmpty)
                }
            }
            .onAppear(perform: setup)
            .onChange(of: d.hasDeadline) { _, _ in applyAutoReminder() }
            .onChange(of: d.deadline) { _, _ in applyAutoReminder() }
            .onChange(of: category) { _, newCategory in
                if newCategory.reminderMode == .always { d.hasReminder = true; askPermission() }
                if newCategory.usesAmount && !newCategory.usesPaidToggle { d.hasAmount = true }
            }
            .confirmationDialog("Ștergi „\(d.trimmedTitle)”?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Șterge", role: .destructive) {
                    if let entry { EntryActions.delete(entry, in: context) }
                    dismiss()
                }
            }
        }
        .tint(category.color)
    }

    // MARK: Sections

    private var subitemsSection: some View {
        Section {
            ForEach($subs) { $s in
                HStack(spacing: 10) {
                    Button { s.isDone.toggle() } label: {
                        Image(systemName: s.isDone ? "checkmark.square.fill" : "square")
                            .font(.title3)
                            .foregroundStyle(s.isDone ? category.color : Color.secondary)
                    }
                    .buttonStyle(.borderless)
                    TextField("Nume", text: $s.title)
                        .strikethrough(s.isDone)
                }
            }
            .onDelete { subs.remove(atOffsets: $0) }
            .onMove { subs.move(fromOffsets: $0, toOffset: $1) }

            HStack(spacing: 10) {
                Image(systemName: "plus.square.fill")
                    .font(.title3)
                    .foregroundStyle(category.color)
                TextField("Adaugă (Enter pentru următorul)", text: $newSub)
                    .focused($newSubFocused)
                    .submitLabel(.next)
                    .onSubmit(addSub)
            }
        } header: {
            Text(category.subitemLabel)
        } footer: {
            if !subs.isEmpty {
                let done = subs.filter(\.isDone).count
                let suffix: String = category.autoCompleteFromSubitems ? " · se bifează singur când sunt toate" : ""
                Text("\(done) din \(subs.count) bifate" + suffix)
            }
        }
    }

    private var detailsSection: some View {
        Section {
            if category.usesDirection {
                Picker("Tip", selection: $d.direction) {
                    ForEach(PaymentDirection.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
            }
            if category.usesVendor {
                TextField(category.vendorLabel, text: $d.vendor)
            }
            if category.usesTracking {
                TextField(category.trackingLabel, text: $d.tracking)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }
            if category.usesAmount {
                if category.usesPaidToggle {
                    Toggle("Are cost", isOn: $d.hasAmount.animation())
                }
                if d.hasAmount || !category.usesPaidToggle {
                    HStack {
                        TextField("Sumă", text: $d.amountText)
                            .keyboardType(.decimalPad)
                        Picker("Monedă", selection: $d.currency) {
                            ForEach(supportedCurrencies, id: \.self) { Text($0).tag($0) }
                        }
                        .labelsHidden()
                        .pickerStyle(.menu)
                        .fixedSize()
                    }
                    if category.usesPaidToggle {
                        Toggle(isOn: $d.isPaid) {
                            Label(d.isPaid ? "Plătit" : "Neplătit (ex: ramburs)",
                                  systemImage: d.isPaid ? "checkmark.seal.fill" : "banknote")
                        }
                    }
                }
            }
        }
    }

    private var organizeSection: some View {
        Section {
            if category.usesPriority {
                Picker(selection: $d.priority) {
                    ForEach(Priority.allCases) { Text($0.label).tag($0) }
                } label: {
                    Label("Prioritate", systemImage: "flag")
                }
            }
            if category.usesGroups {
                HStack {
                    Image(systemName: "folder").foregroundStyle(.purple)
                    TextField("Grup (ex: Casă, Muncă)", text: $d.group)
                    if !groups.isEmpty {
                        Menu {
                            ForEach(groups, id: \.self) { g in
                                Button(g) { d.group = g }
                            }
                        } label: {
                            Image(systemName: "chevron.down.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private var reminderSection: some View {
        Section {
            if category.reminderMode == .optional {
                Toggle(isOn: reminderToggle.animation()) {
                    Label("Amintește-mi", systemImage: "bell.badge")
                }
            }
            if d.hasReminder || category.reminderMode == .always {
                DatePicker("Când", selection: reminderDateBinding, displayedComponents: [.date, .hourAndMinute])
                Picker(selection: $d.repeatRule) {
                    ForEach(ReminderRepeat.allCases) { Text($0.label).tag($0) }
                } label: {
                    Label("Repetă", systemImage: "repeat")
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(quickOptions) { option in
                            Button(option.label) {
                                d.reminderDate = option.date
                                d.hasReminder = true
                                reminderTouched = true
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }
                    }
                }
            }
        } header: {
            Text("Reminder")
        } footer: {
            if notificationsDenied {
                Text("Notificările sunt oprite pentru Bifă. Activează-le din Setări → Notificări → Bifă.")
                    .foregroundStyle(.red)
            } else if (d.hasReminder || category.reminderMode == .always)
                        && d.repeatRule == .none && d.reminderDate < Date() {
                Text("Ora aleasă a trecut deja — alege una din viitor.")
                    .foregroundStyle(.orange)
            } else if d.hasReminder || category.reminderMode == .always {
                Text("Primești notificare cu sunet. Din ea poți bifa direct sau amâna 10 min / 1 oră.")
            }
        }
    }

    // MARK: Reminder helpers

    private var reminderToggle: Binding<Bool> {
        Binding(get: { d.hasReminder }, set: { on in
            d.hasReminder = on
            reminderTouched = true
            if on { askPermission() }
        })
    }

    private var reminderDateBinding: Binding<Date> {
        Binding(get: { d.reminderDate }, set: { d.reminderDate = $0; reminderTouched = true })
    }

    private struct QuickOption: Identifiable {
        let label: String
        let date: Date
        var id: String { label }
    }

    private var quickOptions: [QuickOption] {
        let cal = Calendar.current
        let now = Date()
        var list: [QuickOption] = []
        func append(_ pair: (String, Date)) { list.append(QuickOption(label: pair.0, date: pair.1)) }
        if let inHour = cal.date(byAdding: .hour, value: 1, to: now) { append(("Peste o oră", inHour)) }
        if let evening = cal.date(bySettingHour: 20, minute: 0, second: 0, of: now), evening > now {
            append(("Diseară 20:00", evening))
        }
        if let tomorrow = cal.date(byAdding: .day, value: 1, to: now),
           let t9 = cal.date(bySettingHour: 9, minute: 0, second: 0, of: tomorrow) {
            append(("Mâine 9:00", t9))
        }
        if d.hasDeadline && category.usesDeadline {
            if let before = cal.date(byAdding: .day, value: -1, to: d.deadline),
               let b9 = cal.date(bySettingHour: 9, minute: 0, second: 0, of: before), b9 > now {
                append(("Cu o zi înainte", b9))
            }
            if let same = cal.date(bySettingHour: 9, minute: 0, second: 0, of: d.deadline), same > now {
                append(("În ziua termenului", same))
            }
        }
        if let week = cal.date(byAdding: .day, value: 7, to: now),
           let w9 = cal.date(bySettingHour: 9, minute: 0, second: 0, of: week) {
            append(("Peste o săptămână", w9))
        }
        return list
    }

    /// The list's "auto reminder before deadline" rule (only while the user hasn't set one by hand).
    private func applyAutoReminder() {
        guard category.autoReminder, category.usesDeadline, category.reminderMode != .off, !reminderTouched else { return }
        if d.hasDeadline {
            d.reminderDate = category.autoReminderDate(for: d.deadline)
            d.hasReminder = category.reminderMode == .always || d.reminderDate > Date()
            if d.hasReminder { askPermission() }
        } else if category.reminderMode == .optional {
            d.hasReminder = false
        }
    }

    private func askPermission() {
        Task {
            let status = await NotificationManager.shared.authorizationStatus()
            if status == .notDetermined {
                _ = await NotificationManager.shared.requestAuthorization()
            }
            let after = await NotificationManager.shared.authorizationStatus()
            await MainActor.run { notificationsDenied = (after == .denied) }
        }
    }

    // MARK: Lifecycle

    private func setup() {
        if !loadedSubs {
            loadedSubs = true
            if let entry {
                subs = SubItemStore.fetch(for: entry.uid, in: context)
                    .map { SubItemDraft(id: $0.uid, title: $0.title, isDone: $0.isDone) }
            }
        }
        if entry == nil { titleFocused = true }
        if category.reminderMode == .always || d.hasReminder { askPermission() }
    }

    private func addSub() {
        let t = newSub.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        withAnimation { subs.append(SubItemDraft(title: t)) }
        newSub = ""
        newSubFocused = true
    }

    private func save() {
        addSub()  // keep whatever was typed in the "add" field
        let target: Entry
        if let entry {
            target = entry
        } else {
            target = Entry(categoryID: category.uid)
            context.insert(target)
        }
        d.apply(to: target, category: category)

        if category.usesSubitems {
            SubItemStore.save(subs, for: target.uid, in: context)
            let real = subs.filter { !$0.title.trimmingCharacters(in: .whitespaces).isEmpty }
            if category.autoCompleteFromSubitems && !real.isEmpty && real.allSatisfy(\.isDone) && !target.isDone {
                target.isDone = true
                target.completedAt = Date()
            }
        }

        try? context.save()
        NotificationManager.shared.sync(target, category: category)
        dismiss()
    }
}
