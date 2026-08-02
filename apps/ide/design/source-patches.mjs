/**
 * Echo IDE - Code-OSS source patches
 *
 * Some parts of the design system are neither colors nor CSS: the title bar
 * palette copy and the trust dialog wording live in TypeScript. These patches
 * rewrite exactly those strings.
 *
 * Each patch is an exact-match find/replace so it fails loudly rather than
 * silently mangling a moved line. `apply-code-oss-overlay.mjs` keeps a pristine
 * `.echo-original` beside every patched file and treats an already-applied patch
 * as satisfied, so applying twice is a no-op.
 *
 * Casing note: the reference screens show button and label text in uppercase.
 * That is `text-transform` from echo-design.css, not the string, so the source
 * strings stay sentence case and remain translatable.
 */

export const sourcePatches = [
	{
		file: 'src/vs/workbench/api/browser/viewsExtensionPoint.ts',
		description: 'allow a view container to default into the secondary (right) side bar',
		edits: [
			{
				// Upstream only maps `activitybar` -> Sidebar and `panel` -> Panel, so an
				// extension cannot ask for the right-hand bar. The Echo agent has to live
				// there permanently, the way Cursor keeps its chat on the right, so the
				// missing location is added to the contribution point.
				find: `		'panel': {
			description: localize('views.container.panel', "Contribute views containers to Panel"),
			type: 'array',
			items: viewsContainerSchema
		}
	},
	additionalProperties: false
};`,
				replace: `		'panel': {
			description: localize('views.container.panel', "Contribute views containers to Panel"),
			type: 'array',
			items: viewsContainerSchema
		},
		'auxiliarybar': {
			description: localize('views.container.auxiliarybar', "Contribute views containers to the Secondary Side Bar"),
			type: 'array',
			items: viewsContainerSchema
		}
	},
	additionalProperties: false
};`,
			},
			{
				// Additive: the anchor survives, so an explicit marker prevents a duplicate
				// declaration on re-apply.
				find: `		let panelOrder = 5 + viewContainersRegistry.all.filter(v => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.Panel).length + 1;`,
				replace: `		let panelOrder = 5 + viewContainersRegistry.all.filter(v => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.Panel).length + 1;
		let auxiliaryBarOrder = CUSTOM_VIEWS_START_ORDER + viewContainersRegistry.all.filter(v => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.AuxiliaryBar).length;`,
				appliedMarker: `		let auxiliaryBarOrder = CUSTOM_VIEWS_START_ORDER`,
			},
			{
				find: `					case 'panel':
						panelOrder = this.registerCustomViewContainers(value, description, panelOrder, existingViewContainers, ViewContainerLocation.Panel);
						break;`,
				replace: `					case 'panel':
						panelOrder = this.registerCustomViewContainers(value, description, panelOrder, existingViewContainers, ViewContainerLocation.Panel);
						break;
					case 'auxiliarybar':
						auxiliaryBarOrder = this.registerCustomViewContainers(value, description, auxiliaryBarOrder, existingViewContainers, ViewContainerLocation.AuxiliaryBar);
						break;`,
				appliedMarker: `					case 'auxiliarybar':`,
			},
		],
	},
	{
		file: 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedService.ts',
		description: 'ship no built-in editor walkthrough',
		edits: [
			{
				// The bundled "Get started with VS Code" and "Learn the Fundamentals" tours
				// teach a different product, and their tiles were painting as empty bordered
				// boxes on the welcome page. Extension-contributed walkthroughs still
				// register normally through the extension point below.
				//
				// Single-line anchors on purpose: the surrounding block is separated by blank
				// lines upstream, which a multi-line anchor would have to reproduce exactly.
				find: `		walkthroughs.forEach(async (category, index) => {`,
				replace: `		const builtInWalkthroughs = walkthroughs.filter(() => false);
		builtInWalkthroughs.forEach(async (category, index) => {`,
			},
			{
				find: `				order: walkthroughs.length - index,`,
				replace: `				order: builtInWalkthroughs.length - index,`,
			},
		],
	},
	{
		file: 'src/vs/workbench/browser/parts/titlebar/commandCenterControl.ts',
		description: 'title bar palette reads "Ask Echo anything" and shows its keybinding',
		edits: [
			{
				// The palette is the AI entry point, so it leads with the agent prompt and
				// keeps the workspace as trailing context ("Ask Echo anything - repo").
				find: `						private _getLabel(): string {
							const { prefix, suffix } = that._windowTitle.getTitleDecorations();
							let label = that._windowTitle.workspaceName;
							if (that._windowTitle.isCustomTitleFormat()) {
								label = that._windowTitle.getWindowTitle();
							} else if (that._editorGroupService.partOptions.showTabs === 'none') {
								label = that._windowTitle.fileName ?? label;
							}
							if (!label) {
								label = localize('label.dfl', "Search");
							}`,
				replace: `						private _getLabel(): string {
							const { prefix, suffix } = that._windowTitle.getTitleDecorations();
							const scope = that._windowTitle.workspaceName;
							let label = scope
								? localize('echo.ask.scoped', "Ask Echo anything \\u2014 {0}", scope)
								: localize('echo.ask', "Ask Echo anything");`,
			},
			{
				// Pin the keybinding hint to the right edge of the palette.
				find: `							labelElement.innerText = label;
							reset(container, searchIcon, labelElement);`,
				replace: `							labelElement.innerText = label;
							const shortcutElement = document.createElement('span');
							shortcutElement.classList.add('shortcut');
							shortcutElement.ariaHidden = 'true';
							// The palette action itself ships unbound, so fall back to the quick open
							// chord it delegates to. The design document asks for a Cmd+K hint, but
							// Cmd+K is a reserved chord prefix here (Cmd+K Cmd+S, Cmd+K Cmd+T, ...);
							// rebinding it would break those, so show the binding that truly opens it.
							shortcutElement.innerText = (
								that._keybindingService.lookupKeybinding(action.id)
								?? that._keybindingService.lookupKeybinding('workbench.action.quickOpen')
							)?.getLabel() ?? '';
							reset(container, searchIcon, labelElement, shortcutElement);`,
			},
		],
	},
	{
		file: 'src/vs/workbench/contrib/workspace/browser/workspace.contribution.ts',
		description: 'trust dialog speaks as Echo and names the agent consequence',
		edits: [
			{
				// The dialog now states the agent consequence inline, so there is no external
				// "learn more" link and the product override that fed it is unused.
				find: `			let titleString: string | undefined;
			let learnMoreString: string | undefined;`,
				replace: `			let titleString: string | undefined;`,
				appliedMarker: `			let titleString: string | undefined;
			let trustOption: string | undefined;`,
			},
			{
				find: `				titleString = this.productService.aiGeneratedWorkspaceTrust.title;
				learnMoreString = this.productService.aiGeneratedWorkspaceTrust.startupTrustRequestLearnMore;`,
				replace: `				titleString = this.productService.aiGeneratedWorkspaceTrust.title;`,
				appliedMarker: `				titleString = this.productService.aiGeneratedWorkspaceTrust.title;
				trustOption = this.productService.aiGeneratedWorkspaceTrust.trustOption;`,
			},
			{
				find: `			const title = titleString ?? (this.useWorkspaceLanguage ?
				localize('workspaceTrust', "Do you trust the authors of the files in this workspace?") :
				localize('folderTrust', "Do you trust the authors of the files in this folder?"));`,
				replace: `			const title = titleString ?? (this.useWorkspaceLanguage ?
				localize('echo.trust.workspace', "Do you trust the authors of this workspace?") :
				localize('echo.trust.folder', "Do you trust the authors of this folder?"));`,
			},
			{
				// State the agent consequence plainly: restricted mode keeps it read-only.
				find: `					!isSingleFolderWorkspace ?
						localize('workspaceStartupTrustDetails', "{0} provides features that may automatically execute files in this workspace.", this.productService.nameShort) :
						localize('folderStartupTrustDetails', "{0} provides features that may automatically execute files in this folder.", this.productService.nameShort),
					learnMoreString ?? localize('startupTrustRequestLearnMore', "If you don't trust the authors of these files, we recommend to continue in restricted mode as the files may be malicious. See [our docs](https://aka.ms/vscode-workspace-trust) to learn more."),
					!isEmptyWindow ?
						\`\\\`\${this.labelService.getWorkspaceLabel(workspaceIdentifier, { verbose: Verbosity.LONG })}\\\`\` : '',`,
				replace: `					!isSingleFolderWorkspace ?
						localize('echo.trust.detail.workspace', "{0} can execute files and run agent tasks in this workspace. If you don't trust the authors, continue in restricted mode \\u2014 the agent stays read-only.", this.productService.nameShort) :
						localize('echo.trust.detail.folder', "{0} can execute files and run agent tasks in this folder. If you don't trust the authors, continue in restricted mode \\u2014 the agent stays read-only.", this.productService.nameShort),
					!isEmptyWindow ?
						\`\\\`\${this.labelService.getWorkspaceLabel(workspaceIdentifier, { verbose: Verbosity.LONG })}\\\`\` : '',`,
			},
			{
				find: `				{ label: trustOption ?? localize({ key: 'trustOption', comment: ['&& denotes a mnemonic'] }, "&&Yes, I trust the authors"), sublabel: isSingleFolderWorkspace ? localize('trustFolderOptionDescription', "Trust folder and enable all features") : localize('trustWorkspaceOptionDescription', "Trust workspace and enable all features") },
				{ label: dontTrustOption ?? localize({ key: 'dontTrustOption', comment: ['&& denotes a mnemonic'] }, "&&No, I don't trust the authors"), sublabel: isSingleFolderWorkspace ? localize('dontTrustFolderOptionDescription', "Browse folder in restricted mode") : localize('dontTrustWorkspaceOptionDescription', "Browse workspace in restricted mode") },`,
				replace: `				{ label: trustOption ?? localize({ key: 'echo.trust.yes', comment: ['&& denotes a mnemonic'] }, "&&Yes, I trust the authors"), sublabel: localize('echo.trust.yes.detail', "Enable all features & agent") },
				{ label: dontTrustOption ?? localize({ key: 'echo.trust.no', comment: ['&& denotes a mnemonic'] }, "&&No, restrict"), sublabel: localize('echo.trust.no.detail', "Browse in restricted mode") },`,
			},
		],
	},
];
