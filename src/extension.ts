import * as vscode from 'vscode';
import { gbz80DocumentSymbolProvider } from './DocumentSymbolProvider';

export function activateDocumentSymbolProvider(context: vscode.ExtensionContext) {
    const provider = new gbz80DocumentSymbolProvider();
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language: 'gbz80' }, provider));
}

// This is the main entry point for the RGBDS Z80 extension in Visual Studio Code.
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "rgbds-z80" is now active!');

    activateDocumentSymbolProvider(context);

    // Example of a command registration
    let disposable = vscode.commands.registerCommand('rgbds-z80.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from RGBDS Z80!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    console.log('Extension "rgbds-z80" has been deactivated.');
}
