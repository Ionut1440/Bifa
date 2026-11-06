import SwiftUI
import SwiftData
import UIKit
import UserNotifications

/// "Remindere" tab: an agenda of every reminder from every list, by day.
struct RemindersView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase
    @Query(sort: \ListCategory.sortOrder) private var categories: [ListCategory]
    @Query(filter: #Predicate<Entry> { $0.hasReminder == true }) private var entries: [Entry]

    @State private var editing: Entry?
    @State private var newIn: ListCategory?
    @State private var status: UNAuthorizationStatus = .authorized

    private var catByID: [UUID: ListCategory] {
        Dictionary(categories.map { ($0.uid, $0) }, uniquingKeysWith: { a, _ in a })
    }

    private var missed: [Entry] {
        entries.filter { $0.reminderMissed && catByID[$0.categoryID] != nil }
            .sorted { $0.reminderDate > $1.reminderDate }
    }

    private struct DayGroup: Identifiable {
        let day: Date
        let items: [Entry]
        var id: Date { day }
    }

    private var upcomingByDay: [DayGroup] {
        let cal = Calendar.current
        let upcoming = entries.filter { !$0.isDone && !$0.reminderMissed && catByID[$0.categoryID] != nil }
        let grouped = Dictionary(grouping: upcoming) { cal.startOfDay(for: $0.nextReminderDate) }
        return grouped.keys.sorted().map { day in
            DayGroup(day: day, items: (grouped[day] ?? []).sorted { $0.nextReminderDate < $1.nextReminderDate })
        }
    }

    private var reminderCategories: [ListCategory] {
        let list = categories.filter { $0.reminderMode != .off }
        // lists where everything is a reminder go first
        return list.filter { $0.reminderMode == .always } + list.filter { $0.reminderMode == .optional }
    }

    var body: some View {
        let days = upcomingByDay
        NavigationStack {
            List {
                if status == .denied {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Notificările sunt oprite", systemImage: "bell.slash.fill")
                                .font(.headline)
                                .foregroundStyle(.red)
                            Text("Fără ele nu primești remindere. Le poți porni din Setări.")
                                .font(.subheadline)
                            Button("Deschide Setările") {
                                if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.red)
                        }
                        .padding(.vertical, 4)
                    }
                } else if status == .notDetermined {
                    Section {
                        Button {
                            Task {
                                _ = await NotificationManager.shared.requestAuthorization()
                                await refreshStatus()
                            }
                        } label: {
                            Label("Permite notificările pentru remindere", systemImage: "bell.badge")
                        }
                    }
                }

                if missed.isEmpty && days.isEmpty {
                    ContentUnavailableView {
                        Label("Niciun reminder", systemImage: "bell")
                    } description: {
                        Text("Adaugă unul cu + sau pune „Amintește-mi” la orice element.")
                    }
                    .listRowBackground(Color.clear)
                }

                if !missed.isEmpty {
                    Section {
                        ForEach(missed) { e in row(e) }
                    } header: {
                        Text("Trecute, nebifate").foregroundStyle(.red)
                    }
                }

                ForEach(days) { group in
                    Section(Fmt.dayHeader(group.day)) {
                        ForEach(group.items) { e in row(e) }
                    }
                }
            }
            .navigationTitle("Remindere")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if let first = reminderCategories.first, reminderCategories.count == 1 {
                        Button { newIn = first } label: { Image(systemName: "plus.circle.fill").font(.title3) }
                    } else if !reminderCategories.isEmpty {
                        Menu {
                            ForEach(reminderCategories) { c in
                                Button { newIn = c } label: { Label(c.name, systemImage: c.icon) }
                            }
                        } label: {
                            Image(systemName: "plus.circle.fill").font(.title3)
                        }
                    }
                }
            }
            .sheet(item: $editing) { e in
                if let c = catByID[e.categoryID] { EntryEditor(category: c, entry: e) }
            }
            .sheet(item: $newIn) { c in EntryEditor(category: c) }
            .task { await refreshStatus() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { Task { await refreshStatus() } }
            }
        }
    }

    private func row(_ e: Entry) -> some View {
        let c = catByID[e.categoryID]
        return HStack(alignment: .top, spacing: 10) {
            Text(Fmt.time(e.nextReminderDate))
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(e.reminderMissed ? Color.red : Color.pink)
                .frame(width: 48, alignment: .leading)
                .padding(.top, 4)
            EntryRow(entry: e, category: c, showCategory: true) {
                EntryActions.toggleDone(e, category: c, in: context)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { editing = e }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) { EntryActions.delete(e, in: context) } label: {
                Label("Șterge", systemImage: "trash")
            }
        }
    }

    private func refreshStatus() async {
        let s = await NotificationManager.shared.authorizationStatus()
        await MainActor.run { status = s }
    }
}
