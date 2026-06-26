/*
 * Copyright (C) 2024 Advanced Card Systems Ltd. All rights reserved.
 *
 * This software is the confidential and proprietary information of Advanced
 * Card Systems Ltd. ("Confidential Information").  You shall not disclose such
 * Confidential Information and shall use it only in accordance with the terms
 * of the license agreement you entered into with ACS.
 */

package com.acs.bletest;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatDialogFragment;
import androidx.fragment.app.DialogFragment;

/**
 * The {@code InputDialogFragment} class provides a text field to input commands.
 *
 * @author Godfrey Chung
 * @version 1.0, 23 Oct 2024
 * @since 0.6.1
 */
public class InputDialogFragment extends AppCompatDialogFragment {

    /**
     * Interface definition for a callback to be invoked when positive or negative button is
     * clicked.
     */
    public interface InputDialogListener {

        /**
         * Called when the positive button is clicked.
         *
         * @param dialog the dialog fragment
         */
        void onInputDialogPositiveClick(DialogFragment dialog);

        /**
         * Called when the negative button is clicked.
         *
         * @param dialog the dialog fragment
         */
        void onInputDialogNegativeClick(DialogFragment dialog);
    }

    private InputDialogListener mListener;
    private EditText mCommandsEditText;
    private String mCommands;

    @Override
    public void onAttach(@NonNull Context context) {

        super.onAttach(context);
        try {
            mListener = (InputDialogListener) context;
        } catch (ClassCastException e) {
            throw new ClassCastException(context + " must implement InputDialogListener");
        }
    }

    @NonNull
    @Override
    public Dialog onCreateDialog(@Nullable Bundle savedInstanceState) {

        AlertDialog.Builder builder = new AlertDialog.Builder(getActivity());
        LayoutInflater inflater = requireActivity().getLayoutInflater();
        View view = inflater.inflate(R.layout.dialog_input, null);

        mCommandsEditText = view.findViewById(R.id.dialog_input_edit_text_commands);
        if (savedInstanceState == null) {
            mCommandsEditText.setText(mCommands);
        }

        builder.setTitle(R.string.input)
                .setView(view)
                .setPositiveButton(R.string.ok, (dialog, which) -> {

                    updateData();
                    mListener.onInputDialogPositiveClick(InputDialogFragment.this);
                })
                .setNegativeButton(R.string.cancel,
                        (dialog, which) -> mListener.onInputDialogNegativeClick(
                                InputDialogFragment.this));

        return builder.create();
    }

    /**
     * Get the commands.
     *
     * @return the commands
     */
    public String getCommands() {
        return mCommands;
    }

    /**
     * Sets the commands.
     *
     * @param commands the commands
     */
    public void setCommands(String commands) {
        mCommands = commands;
    }

    /**
     * Updates the data.
     */
    private void updateData() {
        mCommands = mCommandsEditText.getText().toString();
    }
}
