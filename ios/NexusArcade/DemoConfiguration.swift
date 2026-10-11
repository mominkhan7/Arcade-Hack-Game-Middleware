import Foundation
// Public defaults. No Arcade credential is ever bundled in this app.
enum DemoConfiguration {
    static var server: String {Bundle.main.object(forInfoDictionaryKey: "NexusDemoServer") as? String ?? "http://127.0.0.1:4174"}
    static var token: String {Bundle.main.object(forInfoDictionaryKey: "NexusDemoToken") as? String ?? ""}
}
