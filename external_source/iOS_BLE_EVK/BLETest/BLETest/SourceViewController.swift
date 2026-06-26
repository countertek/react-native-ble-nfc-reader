//
// Copyright (C) 2024 Advanced Card Systems Ltd. All rights reserved.
//
// This software is the confidential and proprietary information of Advanced
// Card Systems Ltd. ("Confidential Information").  You shall not disclose such
// Confidential Information and shall use it only in accordance with the terms
// of the license agreement you entered into with ACS.
//

import UIKit

/// The `SourceViewController` class shows sources for selection.
///
/// - Author:  Godfrey Chung
/// - Version: 1.0
/// - Date:    7 Nov 2024
class SourceViewController: UITableViewController {

    /// The array of sources
    static let sources = ["Input", "iTunes File Sharing", "Document Picker"]

    /// The source is input.
    static let sourceInput = 0

    /// The source is iTunes File Sharing.
    static let sourceiTunesFileSharing = 1

    /// The source is Document Picker.
    static let sourceDocumentPicker = 2

    /// The selected source
    var source = sourceDocumentPicker

    /// The delegate object you want to receive source view controller events.
    var delegate: SourceViewControllerDelegate?

    override func viewDidLoad() {
        super.viewDidLoad()

        // Uncomment the following line to preserve selection between presentations
        // self.clearsSelectionOnViewWillAppear = false

        // Uncomment the following line to display an Edit button in the navigation bar for this view controller.
        // self.navigationItem.rightBarButtonItem = self.editButtonItem
    }

    override func tableView(_ tableView: UITableView,
                            cellForRowAt indexPath: IndexPath) -> UITableViewCell {

        let cellId = SourceViewController.sources[indexPath.row]
        var cell = tableView.dequeueReusableCell(withIdentifier: cellId)
        if (cell == nil) {
            cell = UITableViewCell(style: .default, reuseIdentifier: cellId)
        }

        // Show the source on the cell.
        cell!.textLabel?.text = cellId

        // Set the check mark if the source is selected.
        if source == indexPath.row {
            cell!.accessoryType = .checkmark
        }

        return cell!
    }

    override func tableView(_ tableView: UITableView,
                            didSelectRowAt indexPath: IndexPath) {

        tableView.deselectRow(at: indexPath, animated: false)

        // Return if the source is selected.
        if source == indexPath.row {
            return
        }

        let oldIndexPath = IndexPath(row: source, section: 0)

        // Set the check mark on the source.
        if let newCell = tableView.cellForRow(at: indexPath) {
            if newCell.accessoryType == .none {

                newCell.accessoryType = .checkmark
                source = indexPath.row
                delegate?.sourceViewController(self, didSelectSource: source)
            }
        }

        // Reset the check mark on the previous source.
        if let oldCell = tableView.cellForRow(at: oldIndexPath) {
            if oldCell.accessoryType == .checkmark {
                oldCell.accessoryType = .none
            }
        }
    }
}

/// The `SourceViewControllerDelegate` protocol defines the methods that a
/// delegate of a `SourceViewController` object must adopt.
protocol SourceViewControllerDelegate {

    /// Invoked when the source is selected.
    ///
    /// - Parameters:
    ///   - sourceViewController: the source view controller
    ///   - source: the selected source
    func sourceViewController(_ sourceViewController: SourceViewController,
                              didSelectSource source: Int)
}
