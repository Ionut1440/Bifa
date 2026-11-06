import SwiftUI
import SwiftData

/// "Azi" tab: what's overdue, due today and coming up this week, across all lists.
struct TodayView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \ListCategory.sortOrder) private var categories: [ListCategory]
    @Query private var entries: [Entry]
    @Query(sort: \SubItem.sortOrder) private var subitems: [SubItem]

    @State private var editing: Entry?
    @State private var newIn: ListCategory?

    private var catByID: [UUID: ListCategory] {
        Dictionary(categories.map { ($0.uid, $0) }, uniquingKeysWith: { a, _ in a })
    }

    private struct Buckets {
        var overdue: [Entry] = []
        var today: [Entry] = []
        var week: [Entry] = []
    }

    private var buckets: Buckets {
        let cal = Calendar.current
        let startToday = cal.startOfDay(for: Date())
        let tomorrow = cal.date(byAdding: .day, value: 1, to: startToday) ?? startToday
        let weekEnd = cal.date(byAdding: .day, value: 8, to: startToday) ?? startToday
        var b = Buckets()
        for e in Sectioning.sorted(entries.filter { !$0.isDone && catByID[$0.categoryID] != nil }) {
            if e.isOverdue || e.reminderMissed {
                b.overdue.append(e)
            } else if let d = e.sortDate, d < tomorrow {
                b.today.append(e)
            } else if e.hasReminder, cal.isDateInToday(e.nextReminderDate) {
                b.today.append(e)
            } else if let d = e.sortDate, d < weekEnd {
                b.week.append(e)
            }
        }
        return b
    }

    var body: some View {
        let b = buckets
        let subsByEntry = Dictionary(grouping: subitems, by: \.entryID)
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 10) {
                        StatTile(title: "Întârziate", value: "\(b.overdue.count)",
                                 icon: "exclamationmark.circle.fill",
                                 color: b.overdue.isEmpty ? .secondary : .red)
                        StatTile(title: "Azi", value: "\(b.today.count)", icon: "sun.max.fill", color: .orange)
                        StatTile(title: "7 zile", value: "\(b.week.count)", icon: "calendar", color: .blue)
                    }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)

                if b.overdue.isEmpty && b.today.isEmpty && b.week.isEmpty {
                    ContentUnavailableView("Ziua e liberă",
                                           systemImage: "sun.max",
                                           description: Text("Nimic întârziat sau programat în zilele următoare."))
                        .listRowBackground(Color.clear)
                }

                section("Întârziate", b.overdue, color: .red, subs: subsByEntry)
                section("Azi", b.today, color: .orange, subs: subsByEntry)
                section("Următoarele 7 zile", b.week, color: .secondary, subs: subsByEntry)
            }
            .navigationTitle(Fmt.dayHeader(Date()).replacingOccurrences(of: "Azi · ", with: "").capitalizedFirst)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        ForEach(categories) { c in
                            Button { newIn = c } label: { Label(c.name, systemImage: c.icon) }
                        }
                    } label: {
                        Image(systemName: "plus.circle.fill").font(.title3)
                    }
                }
            }
            .sheet(item: $editing) { e in
                if let c = catByID[e.categoryID] { EntryEditor(category: c, entry: e) }
            }
            .sheet(item: $newIn) { c in EntryEditor(category: c) }
        }
    }

    @ViewBuilder
    private func section(_ title: String, _ items: [Entry], color: Color, subs: [UUID: [SubItem]]) -> some View {
        if !items.isEmpty {
            Section {
                ForEach(items) { e in
                    let c = catByID[e.categoryID]
                    EntryRow(entry: e, category: c, showCategory: true,
                             subitems: (c?.usesSubitems ?? false) ? (subs[e.uid] ?? []) : [],
                             onToggleSub: { s in EntryActions.toggleSub(s, of: e, category: c, in: context) }) {
                        EntryActions.toggleDone(e, category: c, in: context)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { editing = e }
                }
            } header: {
                Text(title).foregroundStyle(color)
            }
        }
    }
}

extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}
