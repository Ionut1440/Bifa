import SwiftUI
import SwiftData

@main
struct BifaApp: App {
    let container: ModelContainer

    init() {
        do {
            container = try ModelContainer(for: ListCategory.self, Entry.self, SubItem.self)
        } catch {
            fatalError("Nu pot deschide baza de date: \(error)")
        }
        NotificationManager.shared.configure(container: container)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(\.locale, Locale(identifier: "ro_RO"))
        }
        .modelContainer(container)
    }
}

struct RootView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    @Query private var categories: [ListCategory]
    @Query(filter: #Predicate<Entry> { $0.isDone == false }) private var activeEntries: [Entry]

    private var todayBadge: Int {
        activeEntries.filter { $0.isOverdue || $0.isDueToday || $0.reminderMissed }.count
    }

    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Azi", systemImage: "sun.max.fill") }
                .badge(todayBadge)
            HomeView()
                .tabItem { Label("Liste", systemImage: "square.grid.2x2.fill") }
            RemindersView()
                .tabItem { Label("Remindere", systemImage: "bell.fill") }
        }
        .tint(Theme.accent)
        .task {
            CategoryTemplate.seedIfNeeded(context)
            housekeeping()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { housekeeping() }
        }
    }

    private func housekeeping() {
        let cats = (try? context.fetch(FetchDescriptor<ListCategory>())) ?? []
        EntryActions.cleanup(categories: cats, in: context)
        let withReminder = (try? context.fetch(FetchDescriptor<Entry>(
            predicate: #Predicate { $0.hasReminder == true && $0.isDone == false }))) ?? []
        NotificationManager.shared.resyncAll(withReminder, categories: cats)
    }
}
