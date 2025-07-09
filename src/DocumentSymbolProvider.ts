import * as vscode from 'vscode';

export class gbz80DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        const symbols: vscode.DocumentSymbol[] = [];
        let currentGlobalParent: vscode.DocumentSymbol | null = null;
        let currentMacroParent: vscode.DocumentSymbol | null = null;
        let currentSectionParent: vscode.DocumentSymbol | null = null; // Add SECTION parent tracking

        const lines = document.getText().split(/\r?\n/);

        let macroStartLine = -1; // Track macro start line for debugging
        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            if (_token.isCancellationRequested) return symbols; // Cancellation support
            const line = lines[lineNumber];

            // Match Global Labels (single colon)
            const globalLabelMatch = line.match(/^[ \t]*[a-zA-Z_][\w#@]*:(?=\s|$)/); // Refined regex
            if (globalLabelMatch) {
                const symbol = (this.createSymbol(globalLabelMatch[0], lineNumber, vscode.SymbolKind.Function, 'Global Label'));
                symbols.push(symbol);
                currentGlobalParent = symbol; // Set current parent to the global label
                currentMacroParent = null; // Reset macro parent
                currentSectionParent = null; // Reset section parent
                console.log(`Matched scope: entity.name.label.global.definition.gbz80, Symbol: ${globalLabelMatch[0]}`); // Debug logging
                continue;
            }

            // Match Global Labels (double colon)
            const globalDoubleLabelMatch = line.match(/^[ \t]*[a-zA-Z_][\w#@]*::/); // Refined regex
            if (globalDoubleLabelMatch) {
                const symbol = (this.createSymbol(globalDoubleLabelMatch[0], lineNumber, vscode.SymbolKind.Function, 'Namespace Label'));
                symbols.push(symbol);
                currentGlobalParent = symbol; // Set current parent to the global label
                currentMacroParent = null; // Reset macro parent
                currentSectionParent = null; // Reset section parent
                console.log(`Matched scope: entity.name.label.global.doublecolon.definition.gbz80, Symbol: ${globalDoubleLabelMatch[0]}`); // Debug logging
                continue;
            }

            // Match Local Labels (.label:)
            const localLabelMatch = line.match(/^[ \t]*\.[a-zA-Z_][\w#@]*[:]?\b/); // Refined regex
            if (localLabelMatch) {
                const childSymbol = (this.createSymbol(localLabelMatch[0], lineNumber, vscode.SymbolKind.Variable, 'Local Label'));
                const parent = this.getCurrentParent(currentGlobalParent, currentMacroParent, currentSectionParent); // Use helper function
                if (parent) {
                    if (!parent.children) parent.children = [];
                    parent.children.push(childSymbol);
                } else {
                    console.warn(`Local label "${localLabelMatch[0]}" has no parent.`); // Debug logging
                }
                console.log(`Matched scope: entity.name.label.local.definition.gbz80, Symbol: ${localLabelMatch[0]}`); // Debug logging
                continue;
            }

            // Match Macros
            const macroMatch = line.match(/^[ \t]*MACRO[ \t]+([a-zA-Z_][\w#@]*)/);
            if (macroMatch) {
                const symbol = (this.createSymbol(macroMatch[1], lineNumber, vscode.SymbolKind.Function, 'Macro'));
                symbols.push(symbol);
                currentMacroParent = symbol; // Set current parent to the macro
                macroStartLine = lineNumber; // Track macro start line
                currentGlobalParent = null; // Reset global parent
                currentSectionParent = null; // Reset section parent
                console.log(`Matched scope: meta.definition.macro.gbz80, Symbol: ${macroMatch[1]}`); // Debug logging
                continue;
            }
            // Match Macro End
            if (/^[ \t]*ENDM\b/.test(line)) {
                if (currentMacroParent && macroStartLine >= 0) {
                    const range = new vscode.Range(macroStartLine, 0, lineNumber, line.length);
                    currentMacroParent.range = range; // Update macro range
                    currentMacroParent.selectionRange = range; // Update selection range
                }
                currentMacroParent = null; // Reset macro parent on ENDM
                macroStartLine = -1; // Reset macro start line
                continue;
            }

            // Match Sections
            const sectionMatch = line.match(/^[ \t]*SECTION\b[ \t]+("[^"]+")/);
            if (sectionMatch) {
                const symbol = (this.createSymbol(sectionMatch[1], lineNumber, vscode.SymbolKind.File, 'Section'));
                symbols.push(symbol);
                currentSectionParent = symbol; // Set current parent to the section
                currentGlobalParent = null; // Reset global parent
                currentMacroParent = null; // Reset macro parent
                console.log(`Matched scope: meta.definition.section.gbz80, Symbol: ${sectionMatch[1]}`); // Debug logging
                continue;
            }

            // Match Constants (DEF name EQU ...)
            const defEquMatch = line.match(/^[ \t]*(DEF)[ \t]+([a-zA-Z_][\w#@]*)[ \t]+(EQU)[ \t]+([^\s;]+)/);
            if (defEquMatch) {
                const name = defEquMatch[2];
                const value = defEquMatch[4];

                // Determine SymbolKind based on naming patterns
                let kind: vscode.SymbolKind = vscode.SymbolKind.Constant;
                if (name.startsWith('r')) {
                    kind = vscode.SymbolKind.Field;
                } else if (name.startsWith('STATE_')) {
                    kind = vscode.SymbolKind.EnumMember;
                } else if (name.startsWith('BUTTON_')) {
                    kind = vscode.SymbolKind.EnumMember;
                } else if (name.startsWith('b') || name.startsWith('p')) {
                    kind = vscode.SymbolKind.Variable;
                } else if (name.startsWith('offset_')) {
                    kind = vscode.SymbolKind.Constant;
                }

                const symbol = this.createSymbol(name, lineNumber, kind, `Value: ${value}`);
                symbols.push(symbol);
                console.log(`Matched scope: meta.definition.constant.defequ.gbz80, Symbol: ${name}, Value: ${value}, Kind: ${kind}`); // Debug logging
                continue;
            }
        }

        return symbols;
    }

    private createSymbol(name: string, line: number, kind: vscode.SymbolKind, detail = ''): vscode.DocumentSymbol {
        // Use the full line for the range
        const range = new vscode.Range(line, 0, line, name.length > 0 ? name.length : 1);
        return new vscode.DocumentSymbol(name, detail, kind, range, range);
    }

    private getCurrentParent(
        globalParent: vscode.DocumentSymbol | null,
        macroParent: vscode.DocumentSymbol | null,
        sectionParent: vscode.DocumentSymbol | null
    ): vscode.DocumentSymbol | null {
        return macroParent || globalParent || sectionParent; // Helper function for parent selection
    }
}
