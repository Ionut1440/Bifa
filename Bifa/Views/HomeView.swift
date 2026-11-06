import SwiftUI
import SwiftData

/// "Liste" tab: all lists, reorderable, plus "Listă nouă".
struct HomeView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \ListCategory.sortOrder) private var categories: [ListCategory]
    @Query private var entries: [Entry]

    @State private var creating = false
    @State private var editingRules: ListCategory?

    var body: some View {
        let byCategory = Dictionary(grouping: entries, by: \.categoryID)
        NavigationStack {
            List {
                Section {
                    ForEach(categories) { c in
                        NavigationLink {
                            CategoryListView(category: c)
                        } label: {
                            CategoryRow(category: c, entries: byCategory[c.uid] ?? [])
                        }
                        .swipeActions(edge: .trailing) {
                            Button { editingRules = c } label: {
                                Label("Reguli", systemImage: "slider.horizontal.3")
                            }
                            .tint(.indigo)
                        }
                    }
                    .onMove(perform: move)
                }

                Section {
                    Button { creating = true } label: {
                        Label("Listă nouă", systemImage: "plus.circle.fill")
                            .font(.body.weight(.medium))
                    }
                } footer: {
                    Text("Fiecare listă are regulile ei (sumă, termen, produse, remindere…). Glisează spre stânga pe o listă ca să le schimbi.")
                }
            }
            .navigationTitle("Liste")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { EditButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { creating = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $creating) { CategoryEditor(category: nil) }
            .sheet(item: $editingRules) { c in CategoryEditor(category: c) }
        }
    }

    private func move(from source: IndexSet, to destination: Int) {
        var ordered = categories
        ordered.move(fromOffsets: source, toOffset: destination)
        for (i, c) in ordered.enumerated() { c.sortOrder = i }
        try? context.save()
    }
}

private struct CategoryRow: View {
    let category: ListCategory
    let entries: [Entry]

    var body: some View {
        let active = entries.filter { !$0.isDone }
        let overdue = active.filter { $0.isOverdue || $0.reminderMissed }.count
        let today = active.filter(\.isDueToday).count

        HStack(spacing: 14) {
            CategoryIcon(icon: category.icon, color: category.color, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(category.name).font(.body.weight(.semibold))
                Text(subtitle(active: active.count, overdue: overdue, today: today))
                    .font(.caption)
                    .foregroundStyle(overdue > 0 ? Color.red : Color.secondary)
            }
            Spacer()
            if active.count > 0 {
                Text("\(active.count)")
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .padding(.horizontal, 9)
                    .padding(.vertical, 3)
                    .background(category.color.opacity(0.15), in: Capsule())
                    .foregroundStyle(category.color)
            }
        }
        .padding(.vertical, 4)
    }

    private func subtitle(active: Int, overdue: Int, today: Int) -> String {
        if active == 0 { return "Totul e bifat ✓" }
        var parts = ["\(active) \(active == 1 ? "activ" : "active")"]
        if today > 0 { parts.append("\(today) azi") }
        if overdue > 0 { parts.append("\(overdue) întârziat\(overdue == 1 ? "" : "e")") }
        return parts.joined(separator: " · ")
    }
}
