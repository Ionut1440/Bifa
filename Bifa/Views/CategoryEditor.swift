import SwiftUI
import SwiftData

/// Create / edit a list and its rules (which fields items have, reminders, cleanup…).
struct CategoryEditor: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \ListCategory.sortOrder) private var categories: [ListCategory]

    let original: ListCategory?
    var onDelete: (() -> Void)? = nil

    /// Unsaved copy, so "Renunță" discards everything.
    @State private var draft: ListCategory
    @State private var confirmDelete = false

    init(category: ListCategory?, onDelete: (() -> Void)? = nil) {
        original = category
        self.onDelete = onDelete
        let d = ListCategory(name: "")
        if let category {
            d.copySettings(from: category)
        } else {
            CategoryTemplate.blank.apply(to: d, includeLook: false)
            d.usesDeadline = true
            d.icon = "folder.fill"
            d.colorIndex = 5
        }
        _draft = State(initialValue: d)
    }

    private var trimmedName: String { draft.name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        let b = Bindable(draft)
        NavigationStack {
            Form {
                // Look
                Section {
                    HStack(spacing: 14) {
                        CategoryIcon(icon: draft.icon, color: draft.color, size: 52)
                        TextField("Numele listei", text: b.name)
                            .font(.title3.weight(.semibold))
                    }
                    .padding(.vertical, 4)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(Palette.colors.indices, id: \.self) { i in
                                Circle()
                                    .fill(Palette.colors[i])
                                    .frame(width: 30, height: 30)
                                    .overlay {
                                        if draft.colorIndex == i {
                                            Image(systemName: "checkmark")
                                                .font(.caption.weight(.bold))
                                                .foregroundStyle(.white)
                                        }
                                    }
                                    .onTapGesture { draft.colorIndex = i }
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 10) {
                        ForEach(Palette.icons, id: \.self) { name in
                            Image(systemName: name)
                                .font(.system(size: 17))
                                .frame(width: 40, height: 40)
                                .foregroundStyle(draft.icon == name ? Color.white : Color.primary)
                                .background(draft.icon == name ? draft.color : Color.secondary.opacity(0.12),
                                            in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .onTapGesture { draft.icon = name }
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section {
                    Menu {
                        ForEach(CategoryTemplate.allCases) { t in
                            Button {
                                let keepName = !trimmedName.isEmpty
                                let name = draft.name, icon = draft.icon, color = draft.colorIndex
                                t.apply(to: draft, includeLook: true)
                                if keepName { draft.name = name; draft.icon = icon; draft.colorIndex = color }
                            } label: {
                                Label(t.label, systemImage: t.icon)
                            }
                        }
                    } label: {
                        Label("Copiază regulile unui șablon…", systemImage: "wand.and.stars")
                    }
                } footer: {
                    Text("Ex: alege „Comenzi” ca să ai sumă, plătit/neplătit, AWB și produse.")
                }

                // Fields
                Section {
                    LabeledContent("Indiciu la titlu") {
                        TextField("Titlu", text: b.titlePlaceholder).multilineTextAlignment(.trailing)
                    }

                    Toggle(isOn: b.usesDeadline.animation()) {
                        Label("Termen / dată", systemImage: "calendar")
                    }
                    if draft.usesDeadline {
                        LabeledContent("Se numește") {
                            TextField("Termen limită", text: b.deadlineLabel).multilineTextAlignment(.trailing)
                        }
                        Toggle("Include și ora", isOn: b.deadlineHasTime)
                    }

                    Toggle(isOn: b.usesAmount.animation()) {
                        Label("Sumă de bani", systemImage: "banknote")
                    }
                    if draft.usesAmount {
                        Picker("Moneda implicită", selection: b.defaultCurrency) {
                            ForEach(supportedCurrencies, id: \.self) { Text($0).tag($0) }
                        }
                        Toggle("Plătit / neplătit", isOn: b.usesPaidToggle)
                        Toggle("De plătit / de primit", isOn: b.usesDirection)
                    }

                    Toggle(isOn: b.usesSubitems.animation()) {
                        Label("Sub-elemente (produse, pași)", systemImage: "list.bullet.indent")
                    }
                    if draft.usesSubitems {
                        LabeledContent("Se numesc") {
                            TextField("Sub-elemente", text: b.subitemLabel).multilineTextAlignment(.trailing)
                        }
                        Toggle("Bifează automat când sunt toate bifate", isOn: b.autoCompleteFromSubitems)
                    }

                    Toggle(isOn: b.usesVendor.animation()) {
                        Label("Persoană / magazin", systemImage: "person")
                    }
                    if draft.usesVendor {
                        LabeledContent("Se numește") {
                            TextField("Persoană / magazin", text: b.vendorLabel).multilineTextAlignment(.trailing)
                        }
                    }

                    Toggle(isOn: b.usesTracking.animation()) {
                        Label("Cod / număr (AWB…)", systemImage: "number")
                    }
                    if draft.usesTracking {
                        LabeledContent("Se numește") {
                            TextField("Cod / AWB", text: b.trackingLabel).multilineTextAlignment(.trailing)
                        }
                    }

                    Toggle(isOn: b.usesPriority) {
                        Label("Prioritate", systemImage: "flag")
                    }
                    Toggle(isOn: b.usesGroups) {
                        Label("Grupuri", systemImage: "folder")
                    }
                    LabeledContent("Cuvânt pentru bifă") {
                        TextField("Bifat", text: b.doneLabel).multilineTextAlignment(.trailing)
                    }
                } header: {
                    Text("Ce câmpuri au elementele")
                }

                // Reminders
                Section {
                    Picker("Remindere", selection: reminderModeBinding) {
                        ForEach(ReminderMode.allCases) { Text($0.label).tag($0) }
                    }
                    if draft.reminderMode != .off && draft.usesDeadline {
                        Toggle("Reminder automat înainte de termen", isOn: b.autoReminder.animation())
                        if draft.autoReminder {
                            Stepper(daysBeforeText, value: b.autoReminderDaysBefore, in: 0...30)
                            DatePicker("La ora", selection: autoTimeBinding, displayedComponents: .hourAndMinute)
                        }
                    }
                } header: {
                    Text("Remindere")
                } footer: {
                    if draft.autoReminder && draft.reminderMode != .off && draft.usesDeadline {
                        Text("Când pui un termen, reminderul se completează singur. Îl poți schimba oricând.")
                    }
                }

                // Display & cleanup
                Section {
                    Picker("Grupare", selection: groupModeBinding) {
                        ForEach(GroupMode.allCases) { Text($0.label).tag($0) }
                    }
                    Toggle("Sumar sus (totaluri, întârziate)", isOn: b.showSummary)
                    Picker("Șterge automat bifatele", selection: b.autoDeleteDoneDays) {
                        Text("Niciodată").tag(0)
                        Text("După o zi").tag(1)
                        Text("După 7 zile").tag(7)
                        Text("După 30 de zile").tag(30)
                    }
                } header: {
                    Text("Afișare și curățenie")
                }

                if original != nil {
                    Section {
                        Button(role: .destructive) { confirmDelete = true } label: {
                            Label("Șterge lista", systemImage: "trash")
                        }
                    }
                }
            }
            .navigationTitle(original == nil ? "Listă nouă" : "Reguli listă")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Renunță") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvează") { save() }
                        .fontWeight(.semibold)
                        .disabled(trimmedName.isEmpty)
                }
            }
            .confirmationDialog("Ștergi lista „\(original?.name ?? "")” cu tot ce e în ea?",
                                isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Șterge lista", role: .destructive) { deleteCategory() }
            }
        }
        .tint(draft.color)
    }

    // MARK: Bindings

    private var reminderModeBinding: Binding<ReminderMode> {
        Binding(get: { draft.reminderMode }, set: { draft.reminderMode = $0 })
    }

    private var groupModeBinding: Binding<GroupMode> {
        Binding(get: { draft.groupMode }, set: { draft.groupMode = $0 })
    }

    private var autoTimeBinding: Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(bySettingHour: draft.autoReminderMinutes / 60,
                                      minute: draft.autoReminderMinutes % 60,
                                      second: 0, of: Date()) ?? Date()
            },
            set: {
                let c = Calendar.current.dateComponents([.hour, .minute], from: $0)
                draft.autoReminderMinutes = (c.hour ?? 9) * 60 + (c.minute ?? 0)
            }
        )
    }

    private var daysBeforeText: String {
        switch draft.autoReminderDaysBefore {
        case 0: return "În ziua termenului"
        case 1: return "Cu o zi înainte"
        default: return "Cu \(draft.autoReminderDaysBefore) zile înainte"
        }
    }

    // MARK: Actions

    private func save() {
        draft.name = trimmedName
        if let original {
            original.copySettings(from: draft)
        } else {
            let c = ListCategory(name: trimmedName)
            c.copySettings(from: draft)
            c.sortOrder = (categories.map(\.sortOrder).max() ?? -1) + 1
            context.insert(c)
        }
        try? context.save()
        dismiss()
    }

    private func deleteCategory() {
        guard let original else { return }
        let cid = original.uid
        let descriptor = FetchDescriptor<Entry>(predicate: #Predicate { $0.categoryID == cid })
        for e in (try? context.fetch(descriptor)) ?? [] {
            NotificationManager.shared.cancel(e)
            SubItemStore.deleteAll(for: e.uid, in: context)
            context.delete(e)
        }
        context.delete(original)
        try? context.save()
        dismiss()
        onDelete?()
    }
}
