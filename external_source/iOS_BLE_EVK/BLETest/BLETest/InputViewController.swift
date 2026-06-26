//
// Copyright (C) 2024 Advanced Card Systems Ltd. All rights reserved.
//
// This software is the confidential and proprietary information of Advanced
// Card Systems Ltd. ("Confidential Information").  You shall not disclose such
// Confidential Information and shall use it only in accordance with the terms
// of the license agreement you entered into with ACS.
//

import UIKit

/// The `InputViewController` class provides a text view to input commands.
///
/// - Author:  Godfrey Chung
/// - Version: 1.0
/// - Date:    11 Nov 2024
class InputViewController: UIViewController {

    @IBOutlet weak var commandsTextView: UITextView!

    var commands = ""

    override func viewDidLoad() {
        super.viewDidLoad()

        // Do any additional setup after loading the view.
        commandsTextView.text = commands
    }
}

// MARK: - UITextViewDelegate
extension InputViewController: UITextViewDelegate {

    func textViewDidEndEditing(_ textView: UITextView) {
        if textView == commandsTextView {
            commands = textView.text
        }
    }

    func textView(_ textView: UITextView,
                  shouldChangeTextIn range: NSRange,
                  replacementText text: String) -> Bool {

        var replaced = true

        if textView == commandsTextView {

            // Replace HEX, space and newline characters.
            for c in text {
                if (c < Character("0") || c > Character("9"))
                    && (c < Character("A") || c > Character("F"))
                    && c != Character(" ")
                    && c != Character("\n") {

                    replaced = false
                    break
                }
            }
        }

        return replaced
    }
}
