import XCTest
final class iPadUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
    }
    func screenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    func expectValue(_ value: String, in element: XCUIElement) {
        let condition = XCTNSPredicateExpectation(predicate:NSPredicate(format:"value == %@",value),object:element)
        XCTAssertEqual(XCTWaiter.wait(for:[condition],timeout:10),.completed)
    }
    func testIPadNavigationAndRotation() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()
        XCTAssertTrue(app.staticTexts["本轮结束 · 导出季度报表"].waitForExistence(timeout:10))
        screenshot("ipad-portrait")
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.staticTexts["本轮结束 · 导出季度报表"].waitForExistence(timeout:5))
        let sessions = app.buttons["nav-sessions"]
        if sessions.exists { sessions.tap() } else { app.staticTexts["远程会话"].firstMatch.tap() }
        let field = app.webViews.textFields["测试输入"]
        XCTAssertTrue(field.waitForExistence(timeout:10))
        // Change the live page after load, independently of Simulator keyboard timing.
        let fill = app.webViews.buttons["填入旋转测试草稿"]
        XCTAssertTrue(fill.waitForExistence(timeout:10))
        fill.tap()
        expectValue("rotation-kept",in:field)
        XCUIDevice.shared.orientation = .portrait
        expectValue("rotation-kept",in:field)
        XCUIDevice.shared.orientation = .landscapeLeft
        expectValue("rotation-kept",in:field)
        screenshot("ipad-landscape-session")
        let settings = app.buttons["nav-settings"]
        if settings.exists { settings.tap() } else { app.staticTexts["通知设置"].firstMatch.tap() }
        let completed = app.switches["toggle-task-completed"]
        XCTAssertTrue(completed.waitForExistence(timeout:5))
        let previous = completed.value as? String
        XCTAssertTrue(["0","1"].contains(previous ?? ""))
        let expected = previous == "1" ? "0" : "1"
        completed.coordinate(withNormalizedOffset:CGVector(dx:1,dy:0.5)).withOffset(CGVector(dx:-20,dy:0)).tap()
        expectValue(expected,in:completed)
        screenshot("ipad-landscape-settings")
        XCUIDevice.shared.orientation = .portrait
        expectValue(expected,in:completed)
        screenshot("ipad-portrait-settings")
    }
}
