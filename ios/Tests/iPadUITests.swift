import XCTest
final class iPadUITests: XCTestCase {
    func screenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    func testIPadNavigationAndRotation() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()
        XCTAssertTrue(app.staticTexts["本轮结束 · 导出季度报表"].waitForExistence(timeout:10))
        screenshot("ipad-portrait")
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.staticTexts["本轮结束 · 导出季度报表"].waitForExistence(timeout:5))
        let settings = app.buttons["nav-settings"]
        if settings.exists { settings.tap() } else { app.staticTexts["通知设置"].firstMatch.tap() }
        XCTAssertTrue(app.switches["toggle-task-completed"].waitForExistence(timeout:5))
        app.switches["toggle-task-completed"].tap()
        screenshot("ipad-landscape-settings")
        XCUIDevice.shared.orientation = .portrait
        XCTAssertTrue(app.switches["toggle-task-completed"].waitForExistence(timeout:5))
        screenshot("ipad-portrait-settings")
    }
}