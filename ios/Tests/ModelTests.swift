import XCTest
@testable import DSHRemote
final class ModelTests: XCTestCase {
    func testPairingPreservesPortAndStripsTokenFromBase() throws {
        let (base,token) = try Connection.pairing("https://computer.example:3443/pair?pair=abc&workspace=demo")
        XCTAssertEqual(base.absoluteString,"https://computer.example:3443")
        XCTAssertEqual(token,"abc")
    }
    func testRejectsCredentialsAndMissingToken() {
        XCTAssertThrowsError(try Connection.pairing("https://user:password@example.test/pair?pair=abc"))
        XCTAssertThrowsError(try Connection.pairing("file:///tmp/test?pair=abc"))
        XCTAssertThrowsError(try Connection.pairing("https://example.test"))
    }
    func testSnapshotAndPendingDecode() throws {
        let json = #"{"epoch":"x","cursor":2,"reset":false,"events":[{"id":"event","kind":"task-completed","taskTitle":"导出报表","summary":"共 120 行","body":"完整结果"}],"pending":[{"id":"approval","kind":"approval","body":"写入文件"}]}"#
        let snapshot = try JSONDecoder().decode(Snapshot.self,from:Data(json.utf8))
        XCTAssertEqual(snapshot.events[0].displayTitle,"本轮结束 · 导出报表")
        XCTAssertEqual(snapshot.events[0].text(brief:true),"共 120 行")
        XCTAssertEqual(snapshot.events[0].text(brief:false),"完整结果")
        XCTAssertEqual(snapshot.pending[0].category,.approval)
    }
    func testNotificationPreferencesDoNotAffectApprovalData() {
        var prefs = Preferences()
        prefs.disabled.insert(NotificationKind.approval.rawValue)
        XCTAssertFalse(prefs.enabled(.approval))
        XCTAssertTrue(prefs.enabled(.completed))
    }
}