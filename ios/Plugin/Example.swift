import Foundation

@objc public class Example: NSObject {
    @objc public func echo(_ value: String) -> String {
        print(value)
        return value
    }

    @objc func openMap(_ call: CAPPluginCall) {
        let latitude = call.getString("latitude")
        let longitude = call.getNumber("longitude")

        // more logic

        call.resolve()
    }
}
