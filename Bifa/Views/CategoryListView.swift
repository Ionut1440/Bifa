import SwiftUI
import SwiftData

enum StatusFilter: String, CaseIterable, Identifiable {
    case active, done, all
    var id: String { rawValue }

    var label: String {
        switch self {
        case .active: "Active"
        case .done: "Bifate"
        case .all: "Toate"
        }
    }
}

/// The items of one list (e.g. "Comenzi").
struct CategoryListView: View {
    let category: ListCategory

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var entries: [Entry]
    @Query(sort: \SubItem.sortOrder) private var allSubitems: [SubItem]

    @State private var filter: StatusFilter = .active
    @State private var search = ""
    @State private var editing: Entry?
    @State private var creating = false
    @State private var editingRules = false
    @State private var confirmClear = false

    init(category: ListCategory) {
        self.category = category
        let cid = category.uid
        _entries = Query(filter: #Predicate<Entry> { $0.categoryID == cid },
                         sort: \Entry.createdAt, order: .reverse)
    }

    private var visible: [Entry] {
        let q = search.trimmingCharacters(in: .whitespaces)
        return entries.filter { e in
            switch filter {
            case .active: if e.isDone { return false }
            case .done: if !e.isDone { return false }
            case .all: break
            }
            if q.isEmpty { return true }
            return e.title.localizedCaseInsensitiveContains(q)
                || e.details.localizedCaseInsensitiveContains(q)
                || e.vendor.localizedCaseInsensitiveContains(q)
                || e.group.localizedCaseInsensitiveContains(q)
                || e.tracking.localizedCaseInsensitiveContains(q)
        }
    }

    private var sections: [EntrySection] {
        switch category.groupMode {
        case .date: return Sectioning.byDate(visible)
        case .group: return category.usesGroups ? Sectioning.byGroup(visible) : Sectioning.flat(visible)
        case .none: return Sectioning.flat(visible)
        }
    }

    private var groupModeBinding: Binding<GroupMode> {
        Binding(get: { category.groupMode }, set: { category.groupMode = $0; try? context.save() })
    }

    var body: some View {
        List {
            if category.showSummary && !entries.isEmpty {
                Section {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
                              spacing: 10) {
                        ForEach(Array(tiles.enumerated()), id: \.offset) { _, tile in tile }
                    }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            Section {
                Picker("Filtru", selection: $filter) {
                    ForEach(StatusFilter.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)

            if sections.isEmpty {
                ContentUnavailableView {
                    Label(filter == .done ? "Nimic bifat încă" : "Nimic aici", systemImage: category.icon)
                } description: {
                    Text(search.isEmpty ? "Apasă + ca să adaugi ceva." : "Niciun rezultat pentru „\(search)”.")
                } actions: {
                    if search.isEmpty && filter != .done {
                        Button("Adaugă") { creating = true }
                            .buttonStyle(.borderedProminent)
                            .tint(category.color)
                    }
                }
                .listRowBackground(Color.clear)
            }

            ForEach(sections) { section in
                Section {
                    ForEach(section.items) { e in row(e) }
                } header: {
                    if !section.title.isEmpty {
                        Text(section.title)
                            .foregroundStyle(section.id == "overdue" ? Color.red : Color.secondary)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(category.name)
        .searchable(text: $search, prompt: "Caută în \(category.name)")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Grupare", selection: groupModeBinding) {
                        ForEach(GroupMode.allCases) { m in
                            if m != .group || category.usesGroups {
                                Label(m.label, systemImage: m.icon).tag(m)
                            }
                        }
                    }
                    Button { editingRules = true } label: {
                        Label("Reguli listă", systemImage: "slider.horizontal.3")
                    }
                    Divider()
                    Button(role: .destructive) { confirmClear = true } label: {
                        Label("Șterge bifatele", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { creating = true } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(category.color)
                }
            }
        }
        .sheet(item: $editing) { e in EntryEditor(category: category, entry: e) }
        .sheet(isPresented: $creating) { EntryEditor(category: category) }
        .sheet(isPresented: $editingRules) {
            CategoryEditor(category: category, onDelete: { dismiss() })
        }
        .confirmationDialog("Ștergi toate elementele bifate din \(category.name)?",
                            isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Șterge bifatele", role: .destructive) {
                for e in entries where e.isDone { EntryActions.delete(e, in: context) }
            }
        }
    }

    private var subitemsByEntry: [UUID: [SubItem]] {
        guard category.usesSubitems else { return [:] }
        return Dictionary(grouping: allSubitems, by: \.entryID)
    }

    @ViewBuilder
    private func row(_ e: Entry) -> some View {
        EntryRow(entry: e,
                 category: category,
                 showGroup: category.groupMode != .group,
                 subitems: subitemsByEntry[e.uid] ?? [],
                 onToggleSub: { s in EntryActions.toggleSub(s, of: e, category: category, in: context) }) {
            EntryActions.toggleDone(e, category: category, in: context)
        }
        .contentShape(Rectangle())
        .onTapGesture { editing = e }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) { EntryActions.delete(e, in: context) } label: {
                Label("Șterge", systemImage: "trash")
            }
        }
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button { EntryActions.toggleDone(e, category: category, in: context) } label: {
                Label(e.isDone ? "Debifează" : category.doneLabel,
                      systemImage: e.isDone ? "arrow.uturn.backward" : "checkmark")
            }
            .tint(category.color)
            if category.usesPaidToggle && e.hasAmount {
                Button { EntryActions.togglePaid(e, category: category, in: context) } label: {
                    Label(e.isPaid ? "Neplătit" : "Plătit", systemImage: "banknote")
                }
                .tint(.green)
            }
        }
    }

    // MARK: Summary

    private var tiles: [StatTile] {
        let active = entries.filter { !$0.isDone }
        var t: [StatTile] = [
            StatTile(title: "Active", value: "\(active.count)", icon: category.icon, color: category.color)
        ]
        if category.usesDeadline {
            let overdue = active.filter(\.isOverdue).count
            t.append(StatTile(title: "Întârziate", value: "\(overdue)",
                              icon: "exclamationmark.circle.fill", color: overdue > 0 ? .red : .secondary))
        }
        if category.usesAmount {
            if category.usesDirection {
                let out = active.filter { $0.hasAmount && $0.direction == .outgoing }.map { ($0.amount, $0.currency) }
                let inc = active.filter { $0.hasAmount && $0.direction == .incoming }.map { ($0.amount, $0.currency) }
                t.append(StatTile(title: "De plătit", value: Fmt.totals(out),
                                  icon: PaymentDirection.outgoing.icon, color: .red))
                t.append(StatTile(title: "De primit", value: Fmt.totals(inc),
                                  icon: PaymentDirection.incoming.icon, color: .green))
            } else if category.usesPaidToggle {
                let unpaid = entries.filter { $0.hasAmount && !$0.isPaid }.map { ($0.amount, $0.currency) }
                t.append(StatTile(title: "Neplătit", value: Fmt.totals(unpaid), icon: "banknote", color: .red))
            } else {
                let total = active.filter(\.hasAmount).map { ($0.amount, $0.currency) }
                t.append(StatTile(title: "Total", value: Fmt.totals(total), icon: "sum", color: .blue))
            }
        }
        if !category.usesDeadline && category.reminderMode != .off {
            let upcoming = active.filter { $0.hasReminder && !$0.reminderMissed }.count
            t.append(StatTile(title: "Programate", value: "\(upcoming)", icon: "bell.fill", color: .pink))
        }
        return t
    }
}
