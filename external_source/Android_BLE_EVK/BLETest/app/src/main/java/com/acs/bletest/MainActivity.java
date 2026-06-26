/*
 * Copyright (C) 2017 Advanced Card Systems Ltd. All rights reserved.
 *
 * This software is the confidential and proprietary information of Advanced
 * Card Systems Ltd. ("Confidential Information").  You shall not disclose such
 * Confidential Information and shall use it only in accordance with the terms
 * of the license agreement you entered into with ACS.
 */

package com.acs.bletest;

import android.Manifest;
import android.app.Activity;
import android.app.Dialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.SystemClock;
import android.provider.OpenableColumns;
import android.util.Log;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.RadioButton;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.LayoutRes;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.DialogFragment;
import androidx.preference.PreferenceManager;

import com.acs.smartcardio.BluetoothSmartCard;
import com.acs.smartcardio.BluetoothTerminalManager;
import com.acs.smartcardio.TerminalTimeouts;
import com.acs.smartcardio.TransmitOptions;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

import javax.smartcardio.Card;
import javax.smartcardio.CardChannel;
import javax.smartcardio.CardException;
import javax.smartcardio.CardTerminal;
import javax.smartcardio.CommandAPDU;
import javax.smartcardio.ResponseAPDU;
import javax.smartcardio.TerminalFactory;

/**
 * The {@code MainActivity} class is the main screen that demonstrates the functionality of
 * Bluetooth card terminal.
 *
 * @author Godfrey Chung
 * @version 1.0, 19 Jun 2017
 */
public class MainActivity extends AppCompatActivity
        implements TerminalTypeDialogFragment.TerminalTypeDialogListener,
        MasterKeyDialogFragment.MasterKeyDialogListener,
        TerminalTimeoutsDialogFragment.TerminalTimeoutsDialogListener,
        InputDialogFragment.InputDialogListener {

    /**
     * Interface definition for a callback to be invoked when the card terminal sends the command.
     */
    private interface OnCommandSentListener {

        /**
         * Called when the card terminal sends the command.
         *
         * @param card    the card
         * @param command the command
         * @return the response
         */
        byte[] onCommandSent(Card card, byte[] command) throws CardException;
    }

    /**
     * The {@code TerminalAdapter} class stores the list of card terminals for selection.
     */
    private class TerminalAdapter extends ArrayAdapter<String> {

        private final List<CardTerminal> mTerminals;

        /**
         * Creates an instance of {@code TerminalAdapter}.
         *
         * @param context  the context
         * @param resource the resource ID
         */
        public TerminalAdapter(@NonNull Context context, @LayoutRes int resource) {

            super(context, resource);
            mTerminals = TerminalList.getInstance().getTerminals();
            for (CardTerminal terminal : mTerminals) {
                add(terminal.getName());
            }
        }

        /**
         * Adds the card terminal.
         *
         * @param terminal the card terminal
         */
        public void addTerminal(CardTerminal terminal) {
            if ((terminal != null) && !mTerminals.contains(terminal)) {

                mTerminals.add(terminal);
                add(terminal.getName());

                /* Load the settings. */
                SharedPreferences sharedPref = getSharedPreferences(
                        "com.acs.bletest." + terminal.getName(), Context.MODE_PRIVATE);
                boolean defaultKeyUsed = sharedPref.getBoolean(KEY_PREF_USE_DEFAULT_KEY, true);
                String newKey = sharedPref.getString(KEY_PREF_NEW_KEY, null);
                long connectionTimeout = sharedPref.getLong(KEY_PREF_CONNECTION_TIMEOUT,
                        TerminalTimeouts.DEFAULT_TIMEOUT);
                long powerTimeout = sharedPref.getLong(KEY_PREF_POWER_TIMEOUT,
                        TerminalTimeouts.DEFAULT_TIMEOUT);
                long protocolTimeout = sharedPref.getLong(KEY_PREF_PROTOCOL_TIMEOUT,
                        TerminalTimeouts.DEFAULT_TIMEOUT);
                long apduTimeout = sharedPref.getLong(KEY_PREF_APDU_TIMEOUT,
                        TerminalTimeouts.DEFAULT_TIMEOUT);
                long controlTimeout = sharedPref.getLong(KEY_PREF_CONTROL_TIMEOUT,
                        TerminalTimeouts.DEFAULT_TIMEOUT);

                /* Set the master key. */
                if (!defaultKeyUsed) {

                    mLogger.logMsg("Setting the master key (%s)...", terminal.getName());
                    try {
                        mManager.setMasterKey(terminal, Hex.toByteArray(newKey));
                    } catch (IllegalArgumentException e) {
                        mLogger.logMsg("Error: %s", e.getMessage());
                    }
                }

                /* Set the terminal timeouts. */
                mLogger.logMsg("Setting the terminal timeouts (%s)...", terminal.getName());
                TerminalTimeouts timeouts = mManager.getTimeouts(terminal);
                timeouts.setConnectionTimeout(connectionTimeout);
                timeouts.setPowerTimeout(powerTimeout);
                timeouts.setProtocolTimeout(protocolTimeout);
                timeouts.setApduTimeout(apduTimeout);
                timeouts.setControlTimeout(controlTimeout);
            }
        }

        /**
         * Gets the card terminal.
         *
         * @param index the index
         * @return the card terminal
         */
        public CardTerminal getTerminal(int index) {
            return mTerminals.get(index);
        }

        @Override
        public void clear() {

            super.clear();
            mTerminals.clear();
        }
    }

    private static final String TAG = "MainActivity";
    private static final String STATE_FILENAME = "filename";
    private static final String STATE_LOG = "log";
    private static final String STATE_COMMANDS = "commands";
    private static final long SCAN_PERIOD = 5000;
    private static final String KEY_PREF_USE_DEFAULT_KEY = "pref_use_default_key";
    private static final String KEY_PREF_NEW_KEY = "pref_new_key";
    private static final String KEY_PREF_CONNECTION_TIMEOUT = "pref_connection_timeout";
    private static final String KEY_PREF_POWER_TIMEOUT = "pref_power_timeout";
    private static final String KEY_PREF_PROTOCOL_TIMEOUT = "pref_protocol_timeout";
    private static final String KEY_PREF_APDU_TIMEOUT = "pref_apdu_timeout";
    private static final String KEY_PREF_CONTROL_TIMEOUT = "pref_control_timeout";
    private static final String KEY_PREF_COMMANDS = "pref_commands";

    private BluetoothAdapter mBluetoothAdapter;
    private BluetoothTerminalManager mManager;
    private TerminalFactory mFactory;
    private Handler mHandler;
    private Logger mLogger;
    private CardStateMonitor mCardStateMonitor;
    private Uri mScriptFileUri;
    private String mCommands;

    private Spinner mTerminalSpinner;
    private TerminalAdapter mTerminalAdapter;
    private Button mScanButton;
    private Button mListButton;
    private Button mDisconnectButton;
    private CheckBox mT0CheckBox;
    private CheckBox mT1CheckBox;
    private EditText mControlCodeEditText;
    private RadioButton mScriptRadioButton;
    private Button mTransmitButton;
    private Button mControlButton;
    private TextView mFilenameTextView;
    private TextView mLogTextView;

    private final ActivityResultLauncher<Intent> mEnableBtLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.StartActivityForResult(), result -> {

                        /* User chose not to enable Bluetooth. */
                        if (result.getResultCode() == Activity.RESULT_CANCELED) {
                            finish();
                        }
                    });

    private final ActivityResultLauncher<String> mEnableBtPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestPermission(), isGranted -> {

                        if (isGranted) {

                            Intent intent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                            mEnableBtLauncher.launch(intent);
                        }
                    });

    private final ActivityResultLauncher<String[]> mBtScanPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestMultiplePermissions(), isGranted -> {

                        if (!isGranted.containsValue(false)) {

                            /* Select a terminal type. */
                            DialogFragment fragment = new TerminalTypeDialogFragment();
                            fragment.show(getSupportFragmentManager(), "terminal_type");
                        }
                    });

    private final ActivityResultLauncher<Intent> mSelectFileLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.StartActivityForResult(), result -> {

                        if (result.getResultCode() == Activity.RESULT_OK) {

                            Intent data = result.getData();
                            if (data != null) {

                                /* Show the filename. */
                                mScriptFileUri = data.getData();
                                mFilenameTextView.setText(getDisplayName(mScriptFileUri));
                            }
                        }
                    });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {

            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });

        /* Check the external storage. */
        if (!isExternalStorageWritable()) {

            Toast.makeText(this, R.string.error_external_storage_not_available,
                    Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        /*
         * Use this check to determine whether BLE is supported on the device.  Then you can
         * selectively disable BLE-related features.
         */
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)) {

            Toast.makeText(this, R.string.error_bluetooth_le_not_supported,
                    Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        /*
         * Initializes a Bluetooth adapter.  For API level 18 and above, get a reference to
         * BluetoothAdapter through BluetoothManager.
         */
        final BluetoothManager bluetoothManager =
                (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            mBluetoothAdapter = bluetoothManager.getAdapter();
        }

        /* Checks if Bluetooth is supported on the device. */
        if (mBluetoothAdapter == null) {

            Toast.makeText(this, R.string.error_bluetooth_not_supported, Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        /* Get the Bluetooth terminal manager. */
        mManager = BluetoothSmartCard.getInstance(this).getManager();
        if (mManager == null) {

            Toast.makeText(this, R.string.error_bluetooth_not_supported, Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        /* Get the terminal factory. */
        mFactory = BluetoothSmartCard.getInstance(this).getFactory();
        if (mFactory == null) {

            Toast.makeText(this, R.string.error_bluetooth_provider_not_found,
                    Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        /* Initialize terminal spinner. */
        mTerminalAdapter = new TerminalAdapter(this, android.R.layout.simple_spinner_item);
        mTerminalAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        mTerminalSpinner = findViewById(R.id.activity_main_spinner_terminal);
        mTerminalSpinner.setAdapter(mTerminalAdapter);
        mTerminalSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {

            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                invalidateOptionsMenu();
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
            }
        });

        /* Initialize Scan button. */
        mHandler = new Handler();
        mScanButton = findViewById(R.id.activity_main_button_scan);
        mScanButton.setOnClickListener(v -> {

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {

                /* Android 12 or later: Request BLUETOOTH_SCAN and BLUETOOTH_CONNECT. */
                requestBtScanPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN,
                        Manifest.permission.BLUETOOTH_CONNECT});

            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {

                /* Android 10 - 11: Request ACCESS_FINE_LOCATION. */
                requestBtScanPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION});

            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {

                /* Android 6 - 9: Request ACCESS_COARSE_LOCATION. */
                requestBtScanPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION});

            } else {

                /* Android 4.3 - 5.1: No need to request the permission. */

                /* Select a terminal type. */
                DialogFragment fragment = new TerminalTypeDialogFragment();
                fragment.show(getSupportFragmentManager(), "terminal_type");
            }
        });

        /* Initialize List button. */
        mListButton = findViewById(R.id.activity_main_button_list);
        mListButton.setOnClickListener(v -> {

            mListButton.setEnabled(false);
            mTerminalAdapter.clear();

            try {

                List<CardTerminal> terminals = mFactory.terminals().list();
                for (CardTerminal terminal : terminals) {
                    mTerminalAdapter.addTerminal(terminal);
                }

            } catch (CardException e) {

                e.printStackTrace();
            }

            mListButton.setEnabled(true);
        });

        /* Initialize Disconnect button. */
        mDisconnectButton = findViewById(R.id.activity_main_button_disconnect);
        mDisconnectButton.setOnClickListener(v -> {

            /* Get the selected card terminal. */
            int index = mTerminalSpinner.getSelectedItemPosition();
            if (index == AdapterView.INVALID_POSITION) {

                mLogger.logMsg("Error: Card terminal not selected");
                return;
            }
            final CardTerminal terminal = mTerminalAdapter.getTerminal(index);

            mDisconnectButton.setEnabled(false);
            new Thread(() -> {

                /* Remove the terminal from card state monitor. */
                mCardStateMonitor.removeTerminal(terminal);

                /* Disconnect from the terminal. */
                mLogger.logMsg("Disconnecting %s...", terminal.getName());
                mManager.disconnect(terminal);
                runOnUiThread(() -> mDisconnectButton.setEnabled(true));
            }).start();
        });

        /* Initialize T=0 and T=1 check boxes. */
        mT0CheckBox = findViewById(R.id.activity_main_checkbox_t0);
        mT0CheckBox.setChecked(true);
        mT1CheckBox = findViewById(R.id.activity_main_checkbox_t1);
        mT1CheckBox.setChecked(true);

        /* Initialize Control Code edit text. */
        mControlCodeEditText = findViewById(R.id.activity_main_edit_text_control_code);
        mControlCodeEditText.setText(String.format(Locale.US, "%d",
                BluetoothTerminalManager.IOCTL_ESCAPE));

        /* Initialize Script radio button. */
        mScriptRadioButton = findViewById(R.id.activity_main_radio_button_script);
        mScriptRadioButton.setChecked(true);

        /* Initialize Input button. */
        Button inputButton = findViewById(R.id.activity_main_button_input);
        inputButton.setOnClickListener(v -> {

            /* Show the dialog. */
            InputDialogFragment fragment = new InputDialogFragment();
            fragment.setCommands(mCommands);
            fragment.show(getSupportFragmentManager(), "input");
        });

        /* Initialize Filename text view. */
        mFilenameTextView = findViewById(R.id.activity_main_text_view_filename);

        /* Initialize Select File button. */
        Button selectFileButton = findViewById(R.id.activity_main_button_select_file);
        selectFileButton.setOnClickListener(v -> {

            boolean providerUsed = true;

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {

                providerUsed = false;

            } else {

                /* Use a documents provider to select a file. */
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("text/plain");
                try {
                    mSelectFileLauncher.launch(intent);
                } catch (ActivityNotFoundException e) {
                    providerUsed = false;
                }
            }

            if (!providerUsed) {

                /* Show a dialog to select a file. */
                new FileChooser(MainActivity.this).setFileListener(
                        file -> mFilenameTextView.setText(file.getAbsolutePath())).showDialog();
            }
        });

        /* Initialize Transmit button. */
        mTransmitButton = findViewById(R.id.activity_main_button_transmit);
        mTransmitButton.setOnClickListener(v -> {

            /* Get the selected card terminal. */
            int index = mTerminalSpinner.getSelectedItemPosition();
            if (index == AdapterView.INVALID_POSITION) {

                mLogger.logMsg("Error: Card terminal not selected");
                return;
            }
            final CardTerminal terminal = mTerminalAdapter.getTerminal(index);

            /* Get the selected filename. */
            final String filename = mFilenameTextView.getText().toString();

            /* Check the filename or the commands. */
            final boolean isScript = mScriptRadioButton.isChecked();
            if (isScript) {
                if (filename.isEmpty()) {

                    mLogger.logMsg("Error: File not selected");
                    return;
                }
            } else {
                if (mCommands.isEmpty()) {

                    mLogger.logMsg("Error: Command not found");
                    return;
                }
            }

            /* Get the protocol. */
            String protocol;
            if (mT0CheckBox.isChecked()) {
                if (mT1CheckBox.isChecked()) {
                    protocol = "*";
                } else {
                    protocol = "T=0";
                }
            } else {
                if (mT1CheckBox.isChecked()) {
                    protocol = "T=1";
                } else {
                    mLogger.logMsg("Error: Protocol not selected");
                    return;
                }
            }

            /* Clear the log. */
            mLogger.clear();

            mTransmitButton.setEnabled(false);
            final String finalProtocol = protocol;
            new Thread(() -> {

                try {

                    /* Wait for card insertion. */
                    for (int i = 5; i > 0; i--) {

                        mLogger.logMsg("Waiting for card insertion (%s)... %d", terminal.getName(),
                                i);
                        if (terminal.waitForCardPresent(1000)) {
                            break;
                        }
                    }

                    /* Connect to the card. */
                    mLogger.logMsg("Connecting to the card (%s, %s)...", terminal.getName(),
                            finalProtocol);
                    Card card = terminal.connect(finalProtocol);

                    /* Get the ATR string. */
                    mLogger.logMsg("ATR:");
                    mLogger.logBuffer(card.getATR().getBytes());

                    /* Get the active protocol. */
                    mLogger.logMsg("Active Protocol: %s", card.getProtocol());

                    if (isScript) {

                        /* Run the script. */
                        runScript(card, filename, (card1, command) -> {

                            CardChannel channel = card1.getBasicChannel();
                            CommandAPDU commandAPDU = new CommandAPDU(command);
                            ResponseAPDU responseAPDU = channel.transmit(commandAPDU);

                            return responseAPDU.getBytes();
                        });

                    } else {

                        /* Send the commands. */
                        sendCommands(card, mCommands, (card1, command) -> {

                            CardChannel channel = card1.getBasicChannel();
                            CommandAPDU commandAPDU = new CommandAPDU(command);
                            ResponseAPDU responseAPDU = channel.transmit(commandAPDU);

                            return responseAPDU.getBytes();
                        });
                    }

                    /* Disconnect from the card. */
                    mLogger.logMsg("Disconnecting the card (%s)...", terminal.getName());
                    card.disconnect(false);

                } catch (CardException e) {

                    mLogger.logMsg("Error: %s", e.getMessage());
                    Throwable cause = e.getCause();
                    if (cause != null) {
                        mLogger.logMsg("Cause: %s", cause.getMessage());
                    }
                }

                runOnUiThread(() -> mTransmitButton.setEnabled(true));
            }).start();
        });

        /* Initialize Control button. */
        mControlButton = findViewById(R.id.activity_main_button_control);
        mControlButton.setOnClickListener(v -> {

            /* Get the selected card terminal. */
            int index = mTerminalSpinner.getSelectedItemPosition();
            if (index == AdapterView.INVALID_POSITION) {

                mLogger.logMsg("Error: Card terminal not selected");
                return;
            }
            final CardTerminal terminal = mTerminalAdapter.getTerminal(index);

            /* Get the selected filename. */
            final String filename = mFilenameTextView.getText().toString();

            /* Check the filename or the commands. */
            final boolean isScript = mScriptRadioButton.isChecked();
            if (isScript) {
                if (filename.isEmpty()) {

                    mLogger.logMsg("Error: File not selected");
                    return;
                }
            } else {
                if (mCommands.isEmpty()) {

                    mLogger.logMsg("Error: Command not found");
                    return;
                }
            }

            /* Get the control code. */
            int controlCode;
            try {

                controlCode = Integer.parseInt(mControlCodeEditText.getText().toString());

            } catch (NumberFormatException e) {

                mLogger.logMsg("Error: Invalid control code");
                return;
            }

            /* Clear the log. */
            mLogger.clear();

            mControlButton.setEnabled(false);
            final int finalControlCode = controlCode;
            new Thread(() -> {

                try {

                    /* Connect to the card. */
                    mLogger.logMsg("Connecting to the card (%s, direct)...", terminal.getName());
                    Card card = terminal.connect("direct");

                    if (isScript) {

                        /* Run the script. */
                        runScript(card, filename,
                                (card1, command) -> card1.transmitControlCommand(finalControlCode,
                                        command));

                    } else {

                        /* Send the commands. */
                        sendCommands(card, mCommands,
                                (card1, command) -> card1.transmitControlCommand(finalControlCode,
                                        command));
                    }

                    /* Disconnect from the card. */
                    mLogger.logMsg("Disconnecting the card (%s)...", terminal.getName());
                    card.disconnect(false);

                } catch (CardException e) {

                    mLogger.logMsg("Error: %s", e.getMessage());
                    Throwable cause = e.getCause();
                    if (cause != null) {
                        mLogger.logMsg("Cause: %s", cause.getMessage());
                    }
                }

                runOnUiThread(() -> mControlButton.setEnabled(true));
            }).start();
        });

        /* Initialize Log text view. */
        mLogTextView = findViewById(R.id.activity_main_text_view_log);

        /* Initialize the logger. */
        mLogger = new Logger(this, mLogTextView);

        /* Initialize the card state monitor. */
        mCardStateMonitor = CardStateMonitor.getInstance();
        mCardStateMonitor.setOnStateChangeListener((monitor, terminal, prevState, currState) -> {
            if ((prevState > CardStateMonitor.CARD_STATE_ABSENT)
                    && (currState <= CardStateMonitor.CARD_STATE_ABSENT)) {
                mLogger.logMsg(terminal.getName() + ": removed");
            } else if ((prevState <= CardStateMonitor.CARD_STATE_ABSENT)
                    && (currState > CardStateMonitor.CARD_STATE_ABSENT)) {
                mLogger.logMsg(terminal.getName() + ": inserted");
            }
        });

        /* Restore the contents. */
        if (savedInstanceState != null) {

            mFilenameTextView.setText(savedInstanceState.getCharSequence(STATE_FILENAME));
            mLogTextView.setText(savedInstanceState.getCharSequence(STATE_LOG));
            mCommands = savedInstanceState.getString(STATE_COMMANDS);

        } else {

            /* Load the settings. */
            mLogger.logMsg("Loading the settings...");
            SharedPreferences sharedPref = PreferenceManager.getDefaultSharedPreferences(this);

            boolean t0GetResponsePref = sharedPref.getBoolean(
                    SettingsActivity.KEY_PREF_T0_GET_RESPONSE, true);
            boolean t1GetResponsePref = sharedPref.getBoolean(
                    SettingsActivity.KEY_PREF_T1_GET_RESPONSE, true);
            boolean t1StripLePref = sharedPref.getBoolean(
                    SettingsActivity.KEY_PREF_T1_STRIP_LE, false);

            TransmitOptions.setT0GetResponse(t0GetResponsePref);
            TransmitOptions.setT1GetResponse(t1GetResponsePref);
            TransmitOptions.setT1StripLe(t1StripLePref);

            mLogger.logMsg("Transmit Options");
            mLogger.logMsg("- isT0GetResponse: " + TransmitOptions.isT0GetResponse());
            mLogger.logMsg("- isT1GetResponse: " + TransmitOptions.isT1GetResponse());
            mLogger.logMsg("- isT1StripLe: " + TransmitOptions.isT1StripLe());

            /* Load the commands. */
            mCommands = sharedPref.getString(KEY_PREF_COMMANDS, "");
        }

        /* Hide input window. */
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
    }

    @Override
    public void onDialogItemClick(DialogFragment dialog, int which) {

        mScanButton.setEnabled(false);
        mTerminalAdapter.clear();

        /* Start the scan. */
        mManager.startScan(which,
                terminal -> runOnUiThread(() -> mTerminalAdapter.addTerminal(terminal)));

        /* Stop the scan. */
        mHandler.postDelayed(() -> {

            mManager.stopScan();
            mScanButton.setEnabled(true);
        }, SCAN_PERIOD);
    }

    @Override
    public void onDialogPositiveClick(DialogFragment dialog) {

        /* Get the selected card terminal. */
        int index = mTerminalSpinner.getSelectedItemPosition();
        if (index == AdapterView.INVALID_POSITION) {

            mLogger.logMsg("Error: Card terminal not selected");
            return;
        }

        /* Save the settings. */
        MasterKeyDialogFragment fragment = (MasterKeyDialogFragment) dialog;
        CardTerminal terminal = mTerminalAdapter.getTerminal(index);
        SharedPreferences sharedPref = getSharedPreferences(
                "com.acs.bletest." + terminal.getName(), Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPref.edit();
        editor.putBoolean(KEY_PREF_USE_DEFAULT_KEY, fragment.isDefaultKeyUsed());
        editor.putString(KEY_PREF_NEW_KEY, fragment.getNewKey());
        editor.apply();

        /* Set the master key. */
        mLogger.logMsg("Setting the master key (%s)...", terminal.getName());
        try {
            mManager.setMasterKey(terminal, fragment.isDefaultKeyUsed() ?
                    null : Hex.toByteArray(fragment.getNewKey()));
        } catch (IllegalArgumentException e) {
            mLogger.logMsg("Error: %s", e.getMessage());
        }
    }

    @Override
    public void onDialogNegativeClick(DialogFragment dialog) {

        Dialog d = dialog.getDialog();
        if (d != null) {
            d.cancel();
        }
    }

    @Override
    public void onTerminalTimeoutsDialogPositiveClick(DialogFragment dialog) {

        /* Get the selected card terminal. */
        int index = mTerminalSpinner.getSelectedItemPosition();
        if (index == AdapterView.INVALID_POSITION) {

            mLogger.logMsg("Error: Card terminal not selected");
            return;
        }

        /* Save the settings. */
        TerminalTimeoutsDialogFragment fragment = (TerminalTimeoutsDialogFragment) dialog;
        CardTerminal terminal = mTerminalAdapter.getTerminal(index);
        SharedPreferences sharedPref = getSharedPreferences(
                "com.acs.bletest." + terminal.getName(), Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPref.edit();
        editor.putLong(KEY_PREF_CONNECTION_TIMEOUT, fragment.getConnectionTimeout());
        editor.putLong(KEY_PREF_POWER_TIMEOUT, fragment.getPowerTimeout());
        editor.putLong(KEY_PREF_PROTOCOL_TIMEOUT, fragment.getProtocolTimeout());
        editor.putLong(KEY_PREF_APDU_TIMEOUT, fragment.getApduTimeout());
        editor.putLong(KEY_PREF_CONTROL_TIMEOUT, fragment.getControlTimeout());
        editor.apply();

        /* Set the terminal timeouts. */
        mLogger.logMsg("Setting the terminal timeouts (%s)...", terminal.getName());
        TerminalTimeouts timeouts = mManager.getTimeouts(terminal);
        timeouts.setConnectionTimeout(fragment.getConnectionTimeout());
        timeouts.setPowerTimeout(fragment.getPowerTimeout());
        timeouts.setProtocolTimeout(fragment.getProtocolTimeout());
        timeouts.setApduTimeout(fragment.getApduTimeout());
        timeouts.setControlTimeout(fragment.getControlTimeout());
    }

    @Override
    public void onTerminalTimeoutsDialogNegativeClick(DialogFragment dialog) {

        Dialog d = dialog.getDialog();
        if (d != null) {
            d.cancel();
        }
    }

    @Override
    public void onInputDialogPositiveClick(DialogFragment dialog) {

        InputDialogFragment fragment = (InputDialogFragment) dialog;
        SharedPreferences sharedPref = PreferenceManager.getDefaultSharedPreferences(this);
        SharedPreferences.Editor editor = sharedPref.edit();

        /* Update the commands. */
        mCommands = fragment.getCommands();

        /* Save the commands. */
        editor.putString(KEY_PREF_COMMANDS, mCommands);
        editor.apply();
    }

    @Override
    public void onInputDialogNegativeClick(DialogFragment dialog) {

        Dialog d = dialog.getDialog();
        if (d != null) {
            d.cancel();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();

        /*
         * Ensures Bluetooth is enabled on the device.  If Bluetooth is not currently enabled,
         * fire an intent to display a dialog asking the user to grant permission to enable it.
         */
        if (!mBluetoothAdapter.isEnabled()) {

            /* Android 12 or later requires BLUETOOTH_CONNECT permission to enable Bluetooth. */
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {

                if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                        == PackageManager.PERMISSION_GRANTED) {

                    Intent intent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                    mEnableBtLauncher.launch(intent);

                } else {

                    mEnableBtPermissionLauncher.launch(Manifest.permission.BLUETOOTH_CONNECT);
                }

            } else {

                Intent intent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                mEnableBtLauncher.launch(intent);
            }
        }

        mCardStateMonitor.resume();
    }

    @Override
    protected void onPause() {
        super.onPause();

        mCardStateMonitor.pause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {

        /* Save the contents. */
        outState.putCharSequence(STATE_FILENAME, mFilenameTextView.getText());
        outState.putCharSequence(STATE_LOG, mLogTextView.getText());
        outState.putString(STATE_COMMANDS, mCommands);
        super.onSaveInstanceState(outState);
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {

        getMenuInflater().inflate(R.menu.main, menu);
        return true;
    }

    @Override
    public boolean onPrepareOptionsMenu(Menu menu) {

        MenuItem item = menu.findItem(R.id.menu_show_card_state);

        /* Get the selected card terminal. */
        int index = mTerminalSpinner.getSelectedItemPosition();
        if (index == AdapterView.INVALID_POSITION) {

            item.setEnabled(false);
            return true;
        }

        /* Update the title. */
        CardTerminal terminal = mTerminalAdapter.getTerminal(index);
        if (mCardStateMonitor.isTerminalEnabled(terminal)) {
            item.setTitle(R.string.hide_card_state);
        } else {
            item.setTitle(R.string.show_card_state);
        }

        return true;
    }

    @Override
    public boolean onOptionsItemSelected(final MenuItem item) {

        int id = item.getItemId();

        if (id == R.id.menu_set_master_key) {

            /* Get the selected card terminal. */
            int index = mTerminalSpinner.getSelectedItemPosition();
            if (index == AdapterView.INVALID_POSITION) {

                mLogger.logMsg("Error: Card terminal not selected");
                return true;
            }

            /* Load the settings. */
            CardTerminal terminal = mTerminalAdapter.getTerminal(index);
            SharedPreferences sharedPref = getSharedPreferences(
                    "com.acs.bletest." + terminal.getName(), Context.MODE_PRIVATE);
            boolean defaultKeyUsed = sharedPref.getBoolean(KEY_PREF_USE_DEFAULT_KEY, true);
            String newKey = sharedPref.getString(KEY_PREF_NEW_KEY, null);

            /* Show the dialog. */
            MasterKeyDialogFragment fragment = new MasterKeyDialogFragment();
            fragment.setTerminalName(terminal.getName());
            fragment.setDefaultKeyUsed(defaultKeyUsed);
            fragment.setNewKey(newKey);
            fragment.show(getSupportFragmentManager(), "set_master_key");

        } else if (id == R.id.menu_set_terminal_timeouts) {

            /* Get the selected card terminal. */
            int index = mTerminalSpinner.getSelectedItemPosition();
            if (index == AdapterView.INVALID_POSITION) {

                mLogger.logMsg("Error: Card terminal not selected");
                return true;
            }

            CardTerminal terminal = mTerminalAdapter.getTerminal(index);
            TerminalTimeouts timeouts = mManager.getTimeouts(terminal);

            /* Show the dialog. */
            TerminalTimeoutsDialogFragment fragment = new TerminalTimeoutsDialogFragment();
            fragment.setTerminalName(terminal.getName());
            fragment.setConnectionTimeout(timeouts.getConnectionTimeout());
            fragment.setPowerTimeout(timeouts.getPowerTimeout());
            fragment.setProtocolTimeout(timeouts.getProtocolTimeout());
            fragment.setApduTimeout(timeouts.getApduTimeout());
            fragment.setControlTimeout(timeouts.getControlTimeout());
            fragment.show(getSupportFragmentManager(), "set_terminal_timeouts");

        } else if (id == R.id.menu_get_battery_status) {

            /* Get the selected card terminal. */
            int index = mTerminalSpinner.getSelectedItemPosition();
            if (index == AdapterView.INVALID_POSITION) {

                mLogger.logMsg("Error: Card terminal not selected");
                return true;
            }

            /* Get the battery status. */
            final CardTerminal terminal = mTerminalAdapter.getTerminal(index);
            item.setEnabled(false);
            new Thread(() -> {

                try {

                    mLogger.logMsg("Getting the battery status (%s)...", terminal.getName());
                    int batteryStatus = mManager.getBatteryStatus(terminal, 10000);
                    mLogger.logMsg("Battery Status: " + toBatteryStatusString(batteryStatus));

                } catch (CardException e) {

                    mLogger.logMsg("Error: %s", e.getMessage());
                    Throwable cause = e.getCause();
                    if (cause != null) {
                        mLogger.logMsg("Cause: %s", cause.getMessage());
                    }
                }

                runOnUiThread(() -> item.setEnabled(true));
            }).start();

        } else if (id == R.id.menu_get_battery_level) {

            /* Get the selected card terminal. */
            int index = mTerminalSpinner.getSelectedItemPosition();
            if (index == AdapterView.INVALID_POSITION) {

                mLogger.logMsg("Error: Card terminal not selected");
                return true;
            }

            /* Get the battery level. */
            final CardTerminal terminal = mTerminalAdapter.getTerminal(index);
            item.setEnabled(false);
            new Thread(() -> {

                try {

                    mLogger.logMsg("Getting the battery level (%s)...", terminal.getName());
                    int batteryLevel = mManager.getBatteryLevel(terminal, 10000);
                    if (batteryLevel < 0) {
                        mLogger.logMsg("Battery Level: Not supported");
                    } else {
                        mLogger.logMsg("Battery Level: %d%%", batteryLevel);
                    }

                } catch (CardException e) {

                    mLogger.logMsg("Error: %s", e.getMessage());
                    Throwable cause = e.getCause();
                    if (cause != null) {
                        mLogger.logMsg("Cause: %s", cause.getMessage());
                    }
                }

                runOnUiThread(() -> item.setEnabled(true));
            }).start();

        } else if (id == R.id.menu_get_device_info) {

            /* Get the selected card terminal. */
            int index = mTerminalSpinner.getSelectedItemPosition();
            if (index == AdapterView.INVALID_POSITION) {

                mLogger.logMsg("Error: Card terminal not selected");
                return true;
            }

            /* Get the device information. */
            final CardTerminal terminal = mTerminalAdapter.getTerminal(index);
            item.setEnabled(false);
            new Thread(() -> {

                String[] texts = {

                        "System ID        : ",
                        "Model Number     : ",
                        "Serial Number    : ",
                        "Firmware Revision: ",
                        "Hardware Revision: ",
                        "Software Revision: ",
                        "Manufacturer Name: "
                };

                int[] types = {

                        BluetoothTerminalManager.DEVICE_INFO_SYSTEM_ID,
                        BluetoothTerminalManager.DEVICE_INFO_MODEL_NUMBER_STRING,
                        BluetoothTerminalManager.DEVICE_INFO_SERIAL_NUMBER_STRING,
                        BluetoothTerminalManager.DEVICE_INFO_FIRMWARE_REVISION_STRING,
                        BluetoothTerminalManager.DEVICE_INFO_HARDWARE_REVISION_STRING,
                        BluetoothTerminalManager.DEVICE_INFO_SOFTWARE_REVISION_STRING,
                        BluetoothTerminalManager.DEVICE_INFO_MANUFACTURER_NAME_STRING,
                };

                mLogger.logMsg("Getting the device information (%s)...", terminal.getName());
                for (int i = 0; i < texts.length; i++) {

                    try {

                        String deviceInfo = mManager.getDeviceInfo(terminal, types[i], 10000);
                        if (deviceInfo == null) {
                            mLogger.logMsg(texts[i] + "Not supported");
                        } else {
                            mLogger.logMsg(texts[i] + deviceInfo);
                        }

                    } catch (CardException e) {

                        mLogger.logMsg("Error: %s", e.getMessage());
                        Throwable cause = e.getCause();
                        if (cause != null) {
                            mLogger.logMsg("Cause: %s", cause.getMessage());
                        }
                    }
                }

                runOnUiThread(() -> item.setEnabled(true));
            }).start();

        } else if (id == R.id.menu_show_card_state) {

            /* Get the selected card terminal. */
            int index = mTerminalSpinner.getSelectedItemPosition();
            if (index == AdapterView.INVALID_POSITION) {

                mLogger.logMsg("Error: Card terminal not selected");
                return true;
            }

            /* Show or hide the card state. */
            CardTerminal terminal = mTerminalAdapter.getTerminal(index);
            if (mCardStateMonitor.isTerminalEnabled(terminal)) {
                mCardStateMonitor.removeTerminal(terminal);
            } else {
                mCardStateMonitor.addTerminal(terminal);
            }

        } else if (id == R.id.menu_settings) {

            Intent intent = new Intent(this, SettingsActivity.class);
            startActivity(intent);

        } else {

            return super.onOptionsItemSelected(item);
        }

        return true;
    }

    /**
     * Checks if external storage is available for read and write.
     *
     * @return {@code true} or {@code false}
     */
    private static boolean isExternalStorageWritable() {
        return Environment.getExternalStorageState().equals(Environment.MEDIA_MOUNTED);
    }

    /**
     * Gets the directory.
     *
     * @param dirName the directory name
     * @return the directory
     */
    private File getDir(String dirName) {

        /* Get the directory for the app-specific external storage. */
        File appDir = getExternalFilesDir(null);
        File dir = new File(appDir, dirName);

        /* Make the directory. */
        if (!dir.mkdirs()) {
            Log.e(TAG, "Directory not created");
        }

        return dir;
    }

    /**
     * Runs the script.
     *
     * @param card     the card
     * @param filename the filename
     * @param listener the listener for sending command
     */
    private void runScript(Card card, String filename, OnCommandSentListener listener) {

        /* Opens the log file. */
        File logDir = getDir("Logs");
        DateFormat dateFormat = new SimpleDateFormat("yyyyMMddHHmmss", Locale.US);
        Date date = new Date();
        File logFile = new File(logDir, "Log-" + dateFormat.format(date) + ".txt");
        try {
            mLogger.openLogFile(logFile);
        } catch (IOException e) {
            mLogger.logMsg("Error: Log file open failed");
        }

        mLogger.logMsg("Running the script...");
        BufferedReader bufferedReader = null;
        try {

            /* Open the script file. */
            mLogger.logMsg("Opening %s...", filename);
            bufferedReader = getBufferedReader(filename);

            int numCommands = 0;
            while (true) {

                boolean commandLoaded = false;
                boolean responseLoaded = false;
                byte[] command = null;

                /* Read the first line. */
                String line = bufferedReader.readLine();
                while (line != null) {

                    /* Skip the comment line. */
                    if ((line.length() > 0) && (line.charAt(0) != ';')) {

                        if (!commandLoaded) {

                            command = Hex.toByteArray(line);
                            if ((command != null) && (command.length > 0)) {
                                commandLoaded = true;
                            }

                        } else {

                            if (checkLine(line) > 0) {
                                responseLoaded = true;
                            }
                        }
                    }

                    if (commandLoaded && responseLoaded) {
                        break;
                    }

                    /* Read the next line. */
                    line = bufferedReader.readLine();
                }

                if (!commandLoaded || !responseLoaded) {
                    break;
                }

                /* Increment the number of loaded commands. */
                numCommands++;

                mLogger.logMsg("Command:");
                mLogger.logBuffer(command);

                /* Send the command. */
                long startTime = SystemClock.elapsedRealtime();
                byte[] response = listener.onCommandSent(card, command);
                long time = Math.abs(SystemClock.elapsedRealtime() - startTime);

                mLogger.logMsg("Response:");
                mLogger.logBuffer(response);

                mLogger.logMsg("Bytes Sent    : %d", command.length);
                mLogger.logMsg("Bytes Received: %d", response.length);
                mLogger.logMsg("Transfer Time : %d ms", time);
                mLogger.logMsg("Transfer Rate : %.2f bytes/second",
                        (command.length + response.length) * 1000.0 / time);

                mLogger.logMsg("Expected:");
                mLogger.logHexString(line);

                /* Compare the response. */
                if (compareResponse(line, response)) {

                    mLogger.logMsg("Compare OK");

                } else {

                    mLogger.logMsg("Error: Unexpected response");
                    break;
                }
            }

            if (numCommands == 0) {
                mLogger.logMsg("Error: Cannot load the command");
            }

        } catch (FileNotFoundException e) {

            mLogger.logMsg("Error: Script file not found");

        } catch (IOException e) {

            mLogger.logMsg("Error: Script file read failed");

        } catch (IllegalArgumentException | IllegalStateException e) {

            mLogger.logMsg("Error: %s", e.getMessage());

        } catch (CardException e) {

            mLogger.logMsg("Error: %s", e.getMessage());
            Throwable cause = e.getCause();
            if (cause != null) {
                mLogger.logMsg("Cause: %s", cause.getMessage());
            }

        } finally {

            /* Close the script file. */
            if (bufferedReader != null) {

                mLogger.logMsg("Closing %s...", filename);
                try {
                    bufferedReader.close();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }

            /* Close the log file. */
            mLogger.closeLogFile();
        }
    }

    /**
     * Send the commands.
     *
     * @param card     the card
     * @param commands the commands
     * @param listener the listener for sending command
     * @since 0.6.1
     */
    private void sendCommands(Card card, String commands, OnCommandSentListener listener) {

        /* Opens the log file. */
        File logDir = getDir("Logs");
        DateFormat dateFormat = new SimpleDateFormat("yyyyMMddHHmmss", Locale.US);
        Date date = new Date();
        File logFile = new File(logDir, "Log-" + dateFormat.format(date) + ".txt");
        try {
            mLogger.openLogFile(logFile);
        } catch (IOException e) {
            mLogger.logMsg("Error: Log file open failed");
        }

        mLogger.logMsg("Sending the commands...");
        try {

            int foundIndex;
            int startIndex = 0;

            do {

                byte[] command;

                /* Find newline character. */
                foundIndex = commands.indexOf('\n', startIndex);
                if (foundIndex >= 0) {
                    command = Hex.toByteArray(commands.substring(startIndex, foundIndex));
                } else {
                    command = Hex.toByteArray(commands.substring(startIndex));
                }

                /* Set the next start index. */
                startIndex = foundIndex + 1;

                /* Skip the empty command. */
                if ((command != null) && (command.length > 0)) {

                    mLogger.logMsg("Command:");
                    mLogger.logBuffer(command);

                    /* Send the command. */
                    long startTime = SystemClock.elapsedRealtime();
                    byte[] response = listener.onCommandSent(card, command);
                    long time = Math.abs(SystemClock.elapsedRealtime() - startTime);

                    mLogger.logMsg("Response:");
                    mLogger.logBuffer(response);

                    mLogger.logMsg("Bytes Sent    : %d", command.length);
                    mLogger.logMsg("Bytes Received: %d", response.length);
                    mLogger.logMsg("Transfer Time : %d ms", time);
                    mLogger.logMsg("Transfer Rate : %.2f bytes/second",
                            (command.length + response.length) * 1000.0 / time);
                }

            } while (foundIndex >= 0);

        } catch (IllegalArgumentException | IllegalStateException e) {

            mLogger.logMsg("Error: %s", e.getMessage());

        } catch (CardException e) {

            mLogger.logMsg("Error: %s", e.getMessage());
            Throwable cause = e.getCause();
            if (cause != null) {
                mLogger.logMsg("Cause: %s", cause.getMessage());
            }

        } finally {

            /* Close the log file. */
            mLogger.closeLogFile();
        }
    }

    /**
     * Checks the line.
     *
     * @param line the line
     * @return the number of characters
     */
    private int checkLine(String line) {

        int count = 0;

        if (line != null) {

            for (int i = 0; i < line.length(); i++) {

                char c = line.charAt(i);
                if (((c >= '0') && (c <= '9'))
                        || ((c >= 'A') && (c <= 'F'))
                        || ((c >= 'a') && (c <= 'f'))
                        || (c == 'X')
                        || (c == 'x')) {
                    count++;
                }
            }
        }

        return count;
    }

    /**
     * Compares the response with line.
     *
     * @param line     the line
     * @param response the response
     * @return {@code true} if they are equal, otherwise {@code false}.
     */
    private boolean compareResponse(String line, byte[] response) {

        boolean ret = true;
        int length = 0;
        boolean first = true;
        int j = 0;

        /* Check the parameter. */
        if ((line == null) || (response == null)) {
            return false;
        }

        for (int i = 0; i < line.length(); i++) {

            char c = line.charAt(i);
            int num;

            if ((c >= '0') && (c <= '9')) {
                num = c - '0';
            } else if ((c >= 'A') && (c <= 'F')) {
                num = c - 'A' + 10;
            } else if ((c >= 'a') && (c <= 'f')) {
                num = c - 'a' + 10;
            } else {
                num = -1;
            }

            if ((num >= 0) || (c == 'X') || (c == 'x')) {

                /* Increment the string length. */
                length++;

                if (j >= response.length) {

                    ret = false;
                    break;
                }

                int num2;
                if (first) {
                    num2 = (response[j] >> 4) & 0x0F;
                } else {
                    num2 = response[j++] & 0x0F;
                }

                first = !first;

                if ((c == 'X') || (c == 'x')) {
                    num = num2;
                }

                /* Compare two numbers. */
                if (num2 != num) {

                    ret = false;
                    break;
                }
            }
        }

        /* Return false if the length is not matched. */
        if (length != 2 * response.length) {
            ret = false;
        }

        return ret;
    }

    /**
     * Returns the description from the battery status.
     *
     * @param batteryStatus the battery status
     * @return the description
     * @since 0.4
     */
    private String toBatteryStatusString(int batteryStatus) {

        String string;

        switch (batteryStatus) {

            case BluetoothTerminalManager.BATTERY_STATUS_NOT_SUPPORTED:
                string = "Not supported";
                break;

            case BluetoothTerminalManager.BATTERY_STATUS_NONE:
                string = "No battery";
                break;

            case BluetoothTerminalManager.BATTERY_STATUS_LOW:
                string = "Low";
                break;

            case BluetoothTerminalManager.BATTERY_STATUS_FULL:
                string = "Full";
                break;

            case BluetoothTerminalManager.BATTERY_STATUS_USB_PLUGGED:
                string = "USB plugged";
                break;

            default:
                string = "Unknown";
                break;
        }

        return string;
    }

    /**
     * Gets the display name from the URI.
     *
     * @param uri the URI
     * @return the display name
     * @since 0.5.2
     */
    private String getDisplayName(Uri uri) {

        String displayName = "";

        if (uri != null) {

            Cursor cursor = getContentResolver().query(uri, null, null, null, null, null);
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {

                        int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (index >= 0) {
                            displayName = cursor.getString(index);
                        }
                    }
                } finally {
                    cursor.close();
                }
            }
        }

        return displayName;
    }

    /**
     * Gets the buffered reader.
     *
     * @param filename the filename
     * @return the buffered reader
     * @since 0.5.2
     */
    private BufferedReader getBufferedReader(String filename) throws FileNotFoundException {

        BufferedReader reader;

        if (mScriptFileUri == null) {

            reader = new BufferedReader(new FileReader(filename));

        } else {

            InputStream inputStream = getContentResolver().openInputStream(mScriptFileUri);
            if (inputStream == null) {
                throw new FileNotFoundException();
            }

            reader = new BufferedReader(new InputStreamReader(inputStream));
        }

        return reader;
    }

    /**
     * Requests the Bluetooth scan permissions.
     *
     * @param permissions the array of permissions
     * @since 0.5.3
     */
    private void requestBtScanPermissions(String[] permissions) {

        boolean granted = true;

        /* Check if all permissions are granted. */
        for (String p : permissions) {

            granted = granted && (ContextCompat.checkSelfPermission(this, p)
                    == PackageManager.PERMISSION_GRANTED);
        }

        if (granted) {

            /* Select a terminal type. */
            DialogFragment fragment = new TerminalTypeDialogFragment();
            fragment.show(getSupportFragmentManager(), "terminal_type");

        } else {

            mBtScanPermissionLauncher.launch(permissions);
        }
    }
}
