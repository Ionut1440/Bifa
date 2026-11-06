import SwiftUI
import SwiftData

enum Theme {
    static let accent = Color(red: 0.49, green: 0.36, blue: 0.98)
}

// MARK: - Actions shared by all lists

@MainActor
enum EntryActions {
    static func toggleDone(_ e: Entry, category: ListCategory?, in context: ModelContext) {
        withAnimation(.snappy) {
            e.isDone.toggle()
            e.completedAt = e.isDone ? Date() : nil
        }
        try? context.save()
        if e.isDone {
            NotificationManager.shared.cancel(e)
        } else {
            NotificationManager.shared.sync(e, category: category)
        }
    }

    static func togglePaid(_ e: Entry, category: ListCategory?, in context: ModelContext) {
        withAnimation(.snappy) { e.isPaid.toggle() }
        try? context.save()
        NotificationManager.shared.sync(e, category: category, clearSnooze: false)
    }

    static func delete(_ e: Entry, in context: ModelContext) {
        NotificationManager.shared.cancel(e)
        SubItemStore.deleteAll(for: e.uid, in: context)
        withAnimation { context.delete(e) }
        try? context.save()
    }

    /// Checks / unchecks one sub-item (e.g. one product arrived). If the list's rule says so,
    /// the parent gets checked automatically when everything is checked.
    static func toggleSub(_ s: SubItem, of e: Entry, category: ListCategory?, in context: ModelContext) {
        withAnimation(.snappy) {
            s.isDone.toggle()
            s.doneAt = s.isDone ? Date() : nil
        }
        if category?.autoCompleteFromSubitems ?? true {
            let all = SubItemStore.fetch(for: e.uid, in: context)
            let allDone = !all.isEmpty && all.allSatisfy(\.isDone)
            if allDone && !e.isDone {
                withAnimation(.snappy) { e.isDone = true; e.completedAt = Date() }
                NotificationManager.shared.cancel(e)
            } else if !allDone && e.isDone {
                withAnimation(.snappy) { e.isDone = false; e.completedAt = nil }
                NotificationManager.shared.sync(e, category: category)
            }
        }
        try? context.save()
    }

    /// Applies the "auto-delete checked items after N days" rule.
    static func cleanup(categories: [ListCategory], in context: ModelContext) {
        let now = Date()
        for c in categories where c.autoDeleteDoneDays > 0 {
            let cid = c.uid
            let descriptor = FetchDescriptor<Entry>(predicate: #Predicate { $0.categoryID == cid && $0.isDone == true })
            guard let done = try? context.fetch(descriptor) else { continue }
            for e in done {
                let finished = e.completedAt ?? e.createdAt
                if now.timeIntervalSince(finished) > Double(c.autoDeleteDoneDays) * 86_400 {
                    SubItemStore.deleteAll(for: e.uid, in: context)
                    context.delete(e)
                }
            }
        }
        try? context.save()
    }
}

// MARK: - Chip

struct Chip: View {
    let text: String
    var icon: String? = nil
    var color: Color = .secondary

    var body: some View {
        HStack(spacing: 3) {
            if let icon { Image(systemName: icon).imageScale(.small) }
            Text(text).lineLimit(1)
        }
        .font(.caption.weight(.medium))
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .foregroundStyle(color)
        .background(color.opacity(0.13), in: Capsule())
    }
}

// MARK: - Flow layout (chips that wrap on several lines)

struct FlowLayout: Layout {
    var spacing: CGFloat = 5

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var width: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            width = max(width, x - spacing)
        }
        return CGSize(width: min(width, maxWidth), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - Category icon tile

struct CategoryIcon: View {
    let icon: String
    let color: Color
    var size: CGFloat = 34

    var body: some View {
        Image(systemName: icon)
            .font(.system(size: size * 0.48, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(
                LinearGradient(colors: [color.opacity(0.85), color], startPoint: .top, endPoint: .bottom),
                in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            )
    }
}

// MARK: - Row

struct EntryRow: View {
    let entry: Entry
    let category: ListCategory?
    var showCategory = false
    var showGroup = true
    var subitems: [SubItem] = []
    var onToggleSub: ((SubItem) -> Void)? = nil
    let onToggle: () -> Void

    private var tint: Color { category?.color ?? Theme.accent }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button(action: onToggle) {
                Image(systemName: entry.isDone ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(entry.isDone ? tint : Color.secondary.opacity(0.6))
                    .contentTransition(.symbolEffect(.replace))
            }
            .buttonStyle(.borderless)
            .sensoryFeedback(.success, trigger: entry.isDone)

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    if showCategory, let category {
                        Image(systemName: category.icon)
                            .font(.caption)
                            .foregroundStyle(category.color)
                    }
                    if entry.priority != .normal && !entry.isDone {
                        Image(systemName: entry.priority == .urgent ? "exclamationmark.2" : "exclamationmark")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(entry.priority.color)
                    }
                    Text(entry.title)
                        .font(.body.weight(.medium))
                        .strikethrough(entry.isDone, color: .secondary)
                        .foregroundStyle(entry.isDone ? .secondary : .primary)
                }

                if !entry.details.isEmpty {
                    Text(entry.details)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                let chips = chipViews
                if !chips.isEmpty {
                    FlowLayout {
                        ForEach(chips.indices, id: \.self) { i in chips[i] }
                    }
                }

                if !subitems.isEmpty && !entry.isDone {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(subitems.prefix(6)) { s in
                            HStack(spacing: 6) {
                                Button { onToggleSub?(s) } label: {
                                    Image(systemName: s.isDone ? "checkmark.square.fill" : "square")
                                        .foregroundStyle(s.isDone ? tint : Color.secondary)
                                        .contentTransition(.symbolEffect(.replace))
                                }
                                .buttonStyle(.borderless)
                                .disabled(onToggleSub == nil)
                                Text(s.title)
                                    .font(.subheadline)
                                    .strikethrough(s.isDone, color: .secondary)
                                    .foregroundStyle(s.isDone ? .secondary : .primary)
                                    .lineLimit(1)
                            }
                        }
                        if subitems.count > 6 {
                            Text("+ încă \(subitems.count - 6)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.top, 2)
                }
            }

            Spacer(minLength: 0)

            if entry.hasAmount && entry.amount > 0 {
                Text(amountText)
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(amountColor)
            }
        }
        .padding(.vertical, 2)
        .opacity(entry.isDone ? 0.7 : 1)
    }

    private var usesDirection: Bool { category?.usesDirection ?? false }
    private var usesPaid: Bool { category?.usesPaidToggle ?? false }

    private var amountText: String {
        let base = Fmt.money(entry.amount, entry.currency)
        if usesDirection { return (entry.direction == .outgoing ? "−" : "+") + base }
        return base
    }

    private var amountColor: Color {
        if entry.isDone && usesDirection { return .secondary }
        if usesDirection { return entry.direction.color }
        if usesPaid { return entry.isPaid ? .secondary : .red }
        return .primary
    }

    private var chipViews: [Chip] {
        var chips: [Chip] = []
        let c = category

        if !subitems.isEmpty {
            let done = subitems.filter(\.isDone).count
            let label = (c?.subitemLabel ?? "Sub-elemente").lowercased()
            let color: Color = done == subitems.count ? .green : (done > 0 ? .orange : .secondary)
            let text = done > 0 && done < subitems.count
                ? "Parțial · \(done)/\(subitems.count) \(label)"
                : "\(done)/\(subitems.count) \(label)"
            chips.append(Chip(text: text, icon: "list.bullet.indent", color: color))
        }
        if usesDirection {
            chips.append(Chip(text: entry.direction.label, icon: entry.direction.icon, color: entry.direction.color))
        }
        if usesPaid && entry.hasAmount && entry.amount > 0 {
            chips.append(entry.isPaid
                         ? Chip(text: "Plătit", icon: "checkmark.seal.fill", color: .green)
                         : Chip(text: "Neplătit", icon: "banknote", color: .red))
        }
        if !entry.vendor.isEmpty && (c?.usesVendor ?? true) {
            chips.append(Chip(text: entry.vendor, icon: "person.fill", color: .secondary))
        }
        if entry.hasDeadline {
            let when = entry.deadlineText
            if entry.isOverdue {
                chips.append(Chip(text: "Întârziat · \(when)", icon: "exclamationmark.circle.fill", color: .red))
            } else if entry.isDueToday {
                chips.append(Chip(text: when, icon: "calendar", color: .orange))
            } else {
                chips.append(Chip(text: when, icon: "calendar", color: entry.isDone ? .secondary : .blue))
            }
        }
        if entry.hasReminder && (!entry.isDone || c?.reminderMode == .always) {
            let icon = entry.repeatRule == .none ? "bell.fill" : "repeat"
            var text = Fmt.dayTime(entry.nextReminderDate)
            if entry.repeatRule != .none { text += " · \(entry.repeatRule.label.lowercased())" }
            let color: Color = entry.reminderMissed ? .red : (entry.isDone ? .secondary : .pink)
            chips.append(Chip(text: text, icon: icon, color: color))
        }
        if !entry.tracking.isEmpty && (c?.usesTracking ?? true) {
            chips.append(Chip(text: entry.tracking, icon: "number", color: .secondary))
        }
        if showGroup && !entry.group.isEmpty && (c?.usesGroups ?? true) {
            chips.append(Chip(text: entry.group, icon: "folder.fill", color: .purple))
        }
        return chips
    }
}

// MARK: - Summary tile

struct StatTile: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(color)
            Text(value)
                .font(.headline.monospacedDigit())
                .lineLimit(2)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - Sectioning helpers

struct EntrySection: Identifiable {
    let id: String
    let title: String
    let items: [Entry]
}

enum Sectioning {
    static func sorted(_ items: [Entry]) -> [Entry] {
        items.sorted { a, b in
            if a.isDone != b.isDone { return !a.isDone }
            switch (a.sortDate, b.sortDate) {
            case let (x?, y?) where x != y: return x < y
            case (.some, .none): return true
            case (.none, .some): return false
            default: break
            }
            if a.priorityRaw != b.priorityRaw { return a.priorityRaw > b.priorityRaw }
            return a.createdAt > b.createdAt
        }
    }

    static func byDate(_ items: [Entry]) -> [EntrySection] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let tomorrow = cal.date(byAdding: .day, value: 1, to: today) ?? today
        let dayAfter = cal.date(byAdding: .day, value: 2, to: today) ?? today
        let weekEnd = cal.date(byAdding: .day, value: 7, to: today) ?? today

        var buckets: [(String, String, [Entry])] = [
            ("overdue", "Întârziate", []), ("today", "Azi", []), ("tomorrow", "Mâine", []),
            ("week", "Următoarele 7 zile", []), ("later", "Mai târziu", []),
            ("nodate", "Fără dată", []), ("done", "Bifate", []),
        ]
        func add(_ i: Int, _ e: Entry) { buckets[i].2.append(e) }

        for e in sorted(items) {
            if e.isDone { add(6, e); continue }
            if e.isOverdue || e.reminderMissed && !e.hasDeadline { add(0, e); continue }
            guard let d = e.sortDate else { add(5, e); continue }
            if d < tomorrow { add(1, e) }
            else if d < dayAfter { add(2, e) }
            else if d < weekEnd { add(3, e) }
            else { add(4, e) }
        }
        return buckets.filter { !$0.2.isEmpty }.map { EntrySection(id: $0.0, title: $0.1, items: $0.2) }
    }

    static func byGroup(_ items: [Entry]) -> [EntrySection] {
        let grouped = Dictionary(grouping: items) { $0.group }
        let names = grouped.keys.sorted { a, b in
            if a.isEmpty != b.isEmpty { return !a.isEmpty }
            return a.localizedCaseInsensitiveCompare(b) == .orderedAscending
        }
        return names.map { name in
            EntrySection(id: "g-" + name, title: name.isEmpty ? "Fără grup" : name, items: sorted(grouped[name] ?? []))
        }
    }

    static func flat(_ items: [Entry]) -> [EntrySection] {
        items.isEmpty ? [] : [EntrySection(id: "all", title: "", items: sorted(items))]
    }
}
