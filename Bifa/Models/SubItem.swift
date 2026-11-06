import Foundation
import SwiftData

/// A sub-item of an entry, e.g. one product inside an order (can arrive separately).
@Model
final class SubItem {
    var uid: UUID = UUID()
    var entryID: UUID = UUID()
    var title: String = ""
    var isDone: Bool = false
    var doneAt: Date?
    var sortOrder: Int = 0

    init(entryID: UUID, title: String, sortOrder: Int) {
        self.uid = UUID()
        self.entryID = entryID
        self.title = title
        self.sortOrder = sortOrder
    }
}

/// Editing copy of a sub-item.
struct SubItemDraft: Identifiable, Equatable {
    var id: UUID = UUID()
    var title: String
    var isDone: Bool = false
}

enum SubItemStore {
    static func fetch(for entryID: UUID, in context: ModelContext) -> [SubItem] {
        let descriptor = FetchDescriptor<SubItem>(
            predicate: #Predicate { $0.entryID == entryID },
            sortBy: [SortDescriptor(\SubItem.sortOrder)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    static func deleteAll(for entryID: UUID, in context: ModelContext) {
        for s in fetch(for: entryID, in: context) { context.delete(s) }
    }

    /// Writes the drafts back: updates existing, inserts new, deletes removed.
    static func save(_ drafts: [SubItemDraft], for entryID: UUID, in context: ModelContext) {
        let existing = fetch(for: entryID, in: context)
        let byID = Dictionary(existing.map { ($0.uid, $0) }, uniquingKeysWith: { a, _ in a })
        let keep = Set(drafts.map(\.id))
        for s in existing where !keep.contains(s.uid) { context.delete(s) }

        for (i, d) in drafts.enumerated() {
            let title = d.title.trimmingCharacters(in: .whitespacesAndNewlines)
            if title.isEmpty {
                if let s = byID[d.id] { context.delete(s) }
                continue
            }
            let s: SubItem
            if let found = byID[d.id] {
                s = found
            } else {
                s = SubItem(entryID: entryID, title: title, sortOrder: i)
                s.uid = d.id
                context.insert(s)
            }
            s.title = title
            if s.isDone != d.isDone { s.doneAt = d.isDone ? Date() : nil }
            s.isDone = d.isDone
            s.sortOrder = i
        }
    }
}
