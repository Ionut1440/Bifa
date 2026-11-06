import Foundation

enum Fmt {
    static let ro = Locale(identifier: "ro_RO")

    /// "Azi", "Mâine", "Ieri" or "12 nov." (with year if not the current year)
    static func day(_ d: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(d) { return "Azi" }
        if cal.isDateInTomorrow(d) { return "Mâine" }
        if cal.isDateInYesterday(d) { return "Ieri" }
        if cal.isDate(d, equalTo: Date(), toGranularity: .year) {
            return d.formatted(.dateTime.day().month(.abbreviated).locale(ro))
        }
        return d.formatted(.dateTime.day().month(.abbreviated).year().locale(ro))
    }

    static func time(_ d: Date) -> String {
        d.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits).locale(ro))
    }

    static func dayTime(_ d: Date) -> String {
        "\(day(d)), \(time(d))"
    }

    /// Section header: "Azi", "Mâine" or "joi, 12 noiembrie"
    static func dayHeader(_ d: Date) -> String {
        let cal = Calendar.current
        let long = d.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(ro))
        if cal.isDateInToday(d) { return "Azi · \(long)" }
        if cal.isDateInTomorrow(d) { return "Mâine · \(long)" }
        return long.prefix(1).uppercased() + long.dropFirst()
    }

    static func money(_ amount: Double, _ currency: String) -> String {
        let n = amount.formatted(.number.precision(.fractionLength(0...2)).locale(ro))
        return "\(n) \(currency)"
    }

    /// Sum per currency, e.g. "1.250 RON + 30 EUR"
    static func totals(_ items: [(Double, String)]) -> String {
        var sums: [String: Double] = [:]
        for (amount, cur) in items { sums[cur, default: 0] += amount }
        let parts = sums
            .filter { $0.value != 0 }
            .sorted { $0.key < $1.key }
            .map { money($0.value, $0.key) }
        return parts.isEmpty ? "0" : parts.joined(separator: " + ")
    }

    static func plainNumber(_ v: Double) -> String {
        v.formatted(.number.precision(.fractionLength(0...2)).grouping(.never).locale(ro))
    }

    /// Accepts "12,5", "12.5", "1.250,50", "1 250" …
    static func parseAmount(_ text: String) -> Double? {
        var s = text.replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\u{00A0}", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty { return nil }
        if s.contains(",") && s.contains(".") {
            s = s.replacingOccurrences(of: ".", with: "")
        }
        s = s.replacingOccurrences(of: ",", with: ".")
        return Double(s)
    }
}
