// inter object call marshaller

var iocmName = "$iocm12";
var c_9B1D14CA_8ADC_4110_B4FE_C428750E198F = true;

$iocm12 =
	{
		name: iocmName,

		persistentIdName: "nptcCrBrowserAgentIdentityValue_ver12_0",

		contentAgentName: "g_TestCompleteChromeBrowserAgentScriptHelper12_0",

		persistentIdValue: Math.floor((Math.random() * 100000) + 1),

		context: {},

		OBJECTID_NULL: 0,

		OBJECTID_WINDOW: -1,

		OBJECTID_CONTEXT: -2,

		OBJECTID_AGENT: -3,

		OBJECTID_IOCM: -4,

		objectCache: new Array(),

		objectMonikerCache: new Array(),

		freeIndexes: new Array(),

		nextCacheId: 1,

		nextCacheIdStep: 1,

		cachedNamespaces: {},

		isObject: function (obj) {

			return (typeof (obj) == "object") || (obj instanceof Object) ||
				((typeof (obj) == "undefined") && (obj !== undefined) && (obj.constructor != null));

		},

		getObjectPersistentId: function (obj) {

			if ((typeof (obj) != "object") || (obj == null))
				return 0;
			var persistentId = obj[this.persistentIdName];
			if (typeof (persistentId) == "undefined") {
				persistentId = this.persistentIdValue++;
				obj[this.persistentIdName] = persistentId;
			}
			return persistentId;
		},

		inSandbox: function () {

			return typeof (c_9B1D14CA_8ADC_4110_B4FE_C428750E198F) == "undefined";
		},

		isCustomElement: function (el) {
			var classes = ['Element', 'HTMLElement', 'HTMLAnchorElement', 'HTMLAppletElement', 'HTMLAreaElement', 'HTMLAudioElement', 'HTMLBaseElement', 'HTMLBaseFontElement', 'HTMLBlockquoteElement', 'HTMLBodyElement',
				'HTMLBRElement', 'HTMLButtonElement', 'HTMLCanvasElement', 'HTMLDetailsElement', 'HTMLDirectoryElement', 'HTMLDivElement', 'HTMLDListElement', 'HTMLEmbedElement', 'HTMLFieldSetElement', 'HTMLFontElement',
				'HTMLFormElement', 'HTMLFrameElement', 'HTMLFrameSetElement', 'HTMLHeadElement', 'HTMLHeadingElement', 'HTMLHRElement', 'HTMLHtmlElement', 'HTMLIFrameElement', 'HTMLImageElement', 'HTMLInputElement',
				'HTMLKeygenElement', 'HTMLLabelElement', 'HTMLLegendElement', 'HTMLLIElement', 'HTMLLinkElement', 'HTMLMapElement', 'HTMLMarqueeElement', 'HTMLMediaElement', 'HTMLMenuElement', 'HTMLMetaElement',
				'HTMLMeterElement', 'HTMLModElement', 'HTMLObjectElement', 'HTMLOListElement', 'HTMLOptGroupElement', 'HTMLOptionElement', 'HTMLOutputElement', 'HTMLParagraphElement', 'HTMLParamElement', 'HTMLPictureElement',
				'HTMLPreElement', 'HTMLProgressElement', 'HTMLQuoteElement', 'HTMLScriptElement', 'HTMLSelectElement', 'HTMLSlotElement', 'HTMLSourceElement', 'HTMLSpanElement', 'HTMLStyleElement', 'HTMLTableCaptionElement',
				'HTMLTableCellElement', 'HTMLTableColElement', 'HTMLTableElement', 'HTMLTableRowElement', 'HTMLTableSectionElement', 'HTMLTextAreaElement', 'HTMLTitleElement', 'HTMLUListElement', 'HTMLUnknownElement', 'HTMLVideoElement'];
			var isCustom = false;
			if (window.customElements != null)
				isCustom = window.customElements.get(el.tagName) !== undefined;
			if (!isCustom)
				isCustom = classes.indexOf(el.constructor.name) < 0;
			return isCustom;
		},

		standardTagNames: ['A', 'ABBR', 'ADDRESS', 'APPLET', 'AREA', 'ARTICLE', 'ASIDE', 'AUDIO', 'B', 'BASE', 'BDI', 'BDO', 'BLOCKQUOTE', 'BODY', 'BR', 'BUTTON',
			'CANVAS', 'CAPTION', 'CITE', 'CODE', 'COL', 'COLGROUP', 'DATA', 'DATALIST', 'DD', 'DEL', 'DETAILS', 'DFN', 'DIALOG', 'DIR', 'DIV', 'DL', 'DT', 'EM', 'EMBED',
			'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FONT', 'FOOTER', 'FORM', 'FRAME', 'FRAMESET', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEAD', 'HEADER', 'HGROUP', 'HR', 'HTML',
			'I', 'IFRAME', 'IMG', 'INPUT', 'INS', 'KBD', 'KEYGEN', 'LABEL', 'LEGEND', 'LI', 'LINK', 'MAIN', 'MAP', 'MARK', 'META', 'METER', 'MENU', 'MENUITEM',
			'NAV', 'NOSCRIPT', 'OBJECT', 'OL', 'OPTGROUP', 'OPTION', 'OUTPUT', 'P', 'PARAM', 'PICTURE', 'PRE', 'PROGRESS', 'Q', 'RB', 'RP', 'RT', 'RTC', 'RUBY',
			'S', 'SAMP', 'SCRIPT', 'SECTION', 'SELECT', 'SLOT', 'SMALL', 'SOURCE', 'SPAN', 'STRONG', 'STYLE', 'SUB', 'SUMMARY', 'SUP', 'SVG',
			'TABLE', 'TBODY', 'TD', 'TEMPLATE', 'TEXTAREA', 'TFOOT', 'TH', 'THEAD', 'TIME', 'TITLE', 'TR', 'TRACK', 'U', 'UL', 'VAR', 'VIDEO', 'WBR'],

		canBeCustomElement: function (el) {
			if (!el) return false;

			var tagName = el.tagName || '';
			if (tagName.indexOf('-') >= 0)
				return true;	
			if ((this.standardTagNames.indexOf(tagName) >= 0) && el.getAttribute('is'))
				return true;

			return false;
		},

		getNodeInfo: function (node) {
			var node_info = {};
			try {
				var isElement = (node.nodeType == 1);
				var isInputElement = (isElement && node.tagName.toLowerCase() == 'input');
				if (!isElement || !node.getAttribute('isTestCompleteHiddenNode')) {
					node_info.nodeType = node.nodeType;
					node_info.tagName = node.tagName || '';
					node_info.className = node.className || '';
					node_info.inputType = isInputElement ? node.type : '';
					node_info.inputValue = isInputElement ? node.value : '';
					node_info.id = (isElement && node.getAttribute('id')) || '';
					node_info.name = (isElement && node.getAttribute('name')) || '';
					node_info.role = (isElement && node.getAttribute('role')) || '';
					node_info.hasNonEmptyTextChild = false;
					node_info.firstChildIsNonEmptyText = false;
					node_info.isCustom = (isElement && this.canBeCustomElement(node)) ? this.invoke({ 'method': 'isCustomElement', 'objectId': this.OBJECTID_IOCM, 'flags': 2, 'params': [{ 'objectId': this.calcMoniker(node) }] })["retVal"] : false;
					node_info.hasShadowRoot = node.shadowRoot != null;
					var child = node.firstChild;
					var isFirstChild = true;
					while (child) {
						if (child.nodeType == 3) {
							var txt = child.data;
							if (txt && txt.replace(/^[ \n\r\t]+/, '')) {
								node_info.hasNonEmptyTextChild = true;
								if (isFirstChild)
									node_info.firstChildIsNonEmptyText = true;
								break;
							}
						}
						child = child.nextSibling;
						isFirstChild = false;
					}
					node_info.hasChildren = node_info.hasNonEmptyTextChild || (isElement ? node.childElementCount > 0 : node.hasChildNodes());
				}
			} catch (e) {
				console.trace(e);
			}
			return JSON.stringify(node_info);
		},

		getObjectMoniker: function (objectId) {

			if (typeof (objectId) == "string")
				return objectId;

			if (objectId == this.OBJECTID_NULL)
				return "";

			if (objectId == this.OBJECTID_WINDOW)
				return "window";

			if (objectId == this.OBJECTID_CONTEXT)
				return "window[\"" + this.name + "\"].context";

			if (objectId == this.OBJECTID_AGENT)
				return "window[\"" + this.contentAgentName + "\"]";

			if (objectId == this.OBJECTID_IOCM)
				return "window[\"" + this.name + "\"]";

			var obj = this.objectCache[objectId];
			if (obj === null)
				return "";

			var moniker = this.objectMonikerCache[objectId];
			if (typeof (moniker) != "string")
				moniker = "";

			if ((obj === 0) && (moniker != "")) {
				try {
					obj = this.returnObject(moniker);
					if (obj !== undefined)
						this.objectCache[objectId] = obj;
				} catch (e) {
						console.trace(e);
				}
				return moniker;
			}

			try {
				var newObj = null;
				if (moniker != "") try { newObj = this.returnObject(moniker); } catch (e) { }
				if ((moniker == "") || (newObj !== obj)) {
					var newMoniker = this.calcMoniker(obj);
					if (newMoniker != "") {
						this.objectMonikerCache[objectId] = newMoniker;
						moniker = newMoniker;
					}
				}
			} catch (e) {
				console.log(e);
			}

			return moniker;
		},

		injectObject: function (objectId, moniker) {

			if ((typeof (objectId) != "number") || (objectId == 0))
				return;

			this.objectCache[objectId] = 0;
			this.objectMonikerCache[objectId] = moniker;
		},

		injectObjects: function (obj) {

			if ((typeof (obj) != "object") || (obj === null))
				return obj;

			for (var name in obj) {

				if (name == "$m") {
					this.injectObject(obj["objectId"], obj["$m"]);
					delete obj["$m"];
				}
				else if (typeof (obj[name]) == "object")
					obj[name] = this.injectObjects(obj[name]);
			}

			return obj;
		},

		calcMoniker: function (obj, parentMoniker) {

			if (!this.isObject(obj) || (obj === null))
				return "";

			if ((document != null) && (obj === document.all))
				return "document.all";

			if ((document != null) && (obj === document.frames))
				return "document.frames";

			if (obj == window)
				return "window";

			if (obj == document)
				return "document";

			if ((document != null) && (obj == document.body))
				return "document.body";

			if ((typeof (obj.id) == "string") && (document.getElementById(obj.id) == obj))
				return "document.getElementById(\"" + obj.id + "\")";

			if (!parentMoniker) {
				var objDocument = obj.ownerDocument || obj.document;
				var ownerFrame = (objDocument && objDocument.defaultView) ? objDocument.defaultView.frameElement : null;

				if (ownerFrame) {
					if (obj == objDocument.defaultView)
						return this.calcMoniker(ownerFrame) + ".contentDocument.defaultView";
					if (obj == objDocument)
						return this.calcMoniker(ownerFrame) + ".contentDocument";
					if (obj == objDocument.body)
						return this.calcMoniker(ownerFrame) + ".contentDocument.body";
					if ((typeof (obj.id) == "string") && (objDocument.getElementById(obj.id) == obj))
						return this.calcMoniker(ownerFrame) + ".contentDocument.getElementById(\"" + obj.id + "\")";
				}
			}

			var parentNode = obj.parentNode;
			if ((typeof (parentNode) != "object") || (parentNode == null))
				return "";

			if (!parentMoniker)
				parentMoniker = this.calcMoniker(parentNode);

			if (parentMoniker == "")
				return "";

			for (var i = 0; i < parentNode.childNodes.length; i++) {
				if (parentNode.childNodes[i] == obj)
					return parentMoniker + ".childNodes[" + i + "]";

			}

			return "";
		},

		cacheObject: function (obj, parentMoniker, getterName, depth) {
			if (obj === null)
				return { "objectId": this.OBJECTID_NULL };

			if (obj == window)
				return { "objectId": this.OBJECTID_WINDOW };

			var objectId;

			if (this.freeIndexes.length > 0) {
				objectId = this.freeIndexes.pop();
			} else {
				objectId = this.nextCacheId;
				this.nextCacheId += this.nextCacheIdStep;
			}

			this.objectCache[objectId] = obj;
			var retVal = { "objectId": objectId };

			if (this.isObject(obj)) {
				var hasParentMoniker = (typeof (parentMoniker) == "string") && (parentMoniker != "");
				//var isSpecificGetter = (getterName == "parentNode") || (getterName == "body");
				//var objectMoniker = (hasParentMoniker && isSpecificGetter) ? "" : this.calcMoniker(obj, parentMoniker);
				var objectMoniker = this.calcMoniker(obj);

				if ((objectMoniker == "") && (typeof (getterName) == "string")) {
					if (hasParentMoniker)
						objectMoniker = parentMoniker + ".";
					objectMoniker += getterName;
				}

				this.objectMonikerCache[objectId] = objectMoniker;
				if ((objectMoniker != "") && this.inSandbox())
					retVal["$m"] = objectMoniker;

			} else {
				return retVal;
			}

			depth = (depth || 0) + 1;

			if (typeof (getterName) != "string")
				getterName = "";

			retVal["cache"] = {};

			var ctor = (obj.constructor != null) ? (obj.constructor.name || "") : "";

			if (depth <= 2) {
				var allowPrefetch = false;// TODO: this.inSandbox();
				var typeMoniker = this.getTypeMoniker(obj);
				if (typeof (this.cachedNamespaces[typeMoniker]) == "object") {
					for (var cachedName in this.cachedNamespaces[typeMoniker]) {
						var hasProp = this.cachedNamespaces[typeMoniker][cachedName];
						if (hasProp == -1)
							hasProp = this.hasProperty.apply(obj, [cachedName, this]);

						if ((hasProp == 1) && allowPrefetch) {
							var propVal = obj[cachedName];
							if (!this.isObject(propVal) || (propVal === null) || (depth == 1)) {
								retVal["cache"][cachedName] = this.encodeParam(propVal, objectMoniker, cachedName, depth);
								continue;
							}
						}
						retVal["cache"]["#has,\"" + cachedName + "\""] = hasProp;
					}
				}
			}

			if (ctor == "Object") {
				retVal["cache"]["$ctor"] = ctor;
				return retVal;
			}

			if (ctor == "NamedNodeMap") {
				retVal["cache"]["$ctor"] = ctor;
				retVal["cache"]["#has,\"getNamedItem\""] = 2;
				retVal["cache"]["getNamedItem,\"id\""] = this.cacheObject(obj.getNamedItem("id"), objectMoniker, "getNamedItem(\"id\")", depth);
				retVal["cache"]["getNamedItem,\"isTestCompleteHiddenNode\""] = this.cacheObject(obj.getNamedItem("isTestCompleteHiddenNode"), objectMoniker, "getNamedItem(\"isTestCompleteHiddenNode\")", depth);
				return retVal;
			} else if (ctor == "ClientRect") {

				retVal["cache"]["$ctor"] = ctor;
				retVal["cache"]["left"] = obj.left || 0;
				retVal["cache"]["top"] = obj.top || 0;
				retVal["cache"]["width"] = obj.width || 0;
				retVal["cache"]["height"] = obj.height || 0;
				return retVal;
			} else if (ctor == "Attr") {
				retVal["cache"]["value"] = obj.value;
			} else if (ctor == "Array") {

				retVal["cache"]["$ctor"] = ctor;
				for (var i = 0; i < (obj.length > 50 ? 50 : obj.length); i++) {
					var propVal = obj[i];
					if (!this.isObject(propVal) || (propVal === null) || (depth == 1))
						retVal["cache"][i] = this.encodeParam(propVal, objectMoniker, i.toString(), depth);
					else
						retVal["cache"]["#has,\"" + i.toString() + "\""] = 1;
				}
				return retVal;
			}

			var tagName = obj["tagName"] || "";
			if ((ctor == "") && (tagName == "OBJECT"))
				ctor = "HTMLObjectElement";
			retVal["cache"]["$ctor"] = ctor;

			var nodeType = -1;
			if (typeof (obj["nodeType"]) != "undefined") {
				nodeType = obj["nodeType"] || 0;
				retVal["cache"]["nodeType"] = nodeType;
			}

			var nodeName = "";
			if (typeof (obj["nodeName"]) == "string") {
				nodeName = obj["nodeName"].toUpperCase();
				retVal["cache"]["nodeName"] = nodeName;
			}

			if (nodeType == 9 /* Document */) {
				retVal["cache"]["clientLeft"] = obj["clientLeft"] || 0;
				retVal["cache"]["clientTop"] = obj["clientTop"] || 0;
				retVal["cache"]["defaultView"] = this.cacheObject(obj["defaultView"], objectMoniker, "defaultView", depth);;
				return retVal;
			}

			if ((nodeType != 1 /* Element */) && (nodeType != 3 /* TextNode */) && (nodeType != 8 /* Comment */))
				return retVal;

			if ((depth > 1) && ((getterName == "parentNode") || (getterName == "offsetParent"))) {

				retVal["cache"]["tagName"] = tagName;
				if (tagName == "TR")
					retVal["cache"]["rowIndex"] = obj["rowIndex"];

				var persistentId = this.getObjectPersistentId(obj);
				return retVal;
			}

			retVal["cache"]["nodeValue"] = obj["nodeValue"] || "";

			if ((depth <= 50) && ((getterName == "firstChild") || (getterName == "nextSibling"))) {
				var sibling = obj["nextSibling"];
				if (typeof (sibling) == "object")
					retVal["cache"]["nextSibling"] = this.cacheObject(sibling, parentMoniker, "nextSibling", depth);
				if (getterName == "nextSibling") {
					var firstChild = obj["firstChild"];
					if ((firstChild != null) && (firstChild["nextSibling"] == null))
						retVal["cache"]["firstChild"] = this.cacheObject(firstChild, objectMoniker, "firstChild", depth);
				}
			} else
				if ((depth <= 50) && ((getterName == "nextElementSibling") || (getterName == "firstElementChild"))) {
					var sibling = obj["nextElementSibling"];
					if (typeof (sibling) == "object")
						retVal["cache"]["nextElementSibling"] = this.cacheObject(sibling, parentMoniker, "nextElementSibling", depth);
				} else
					if ((depth == 1) && (getterName == "offsetParent")) {

						retVal["cache"]["offsetLeft"] = obj["offsetLeft"] || 0;
						retVal["cache"]["offsetTop"] = obj["offsetTop"] || 0;
					} else
						if ((depth == 1) && (getterName == "parentElement")) {

							retVal["cache"]["clientLeft"] = obj["clientLeft"] || 0;
							retVal["cache"]["clientTop"] = obj["clientTop"] || 0;
							retVal["cache"]["clientHeight"] = obj["clientHeight"] || 0;
							retVal["cache"]["clientWidth"] = obj["clientWidth"] || 0;
							retVal["cache"]["scrollLeft"] = obj["scrollLeft"] || 0;
							retVal["cache"]["scrollTop"] = obj["scrollTop"] || 0;
							retVal["cache"]["offsetLeft"] = obj["offsetLeft"] || 0;
							retVal["cache"]["offsetTop"] = obj["offsetTop"] || 0;
							retVal["cache"]["ownerDocument"] = this.cacheObject(obj["ownerDocument"], objectMoniker, "ownerDocument", depth);
							retVal["cache"]["offsetParent"] = this.cacheObject(obj["offsetParent"], objectMoniker, "offsetParent", depth);
						}

			if (obj["firstChild"] == null)
				retVal["cache"]["firstChild"] = { "objectId": 0 };

			if (obj["firstElementChild"] == null)
				retVal["cache"]["firstElementChild"] = { "objectId": 0 };


			if (nodeType != 1)
				return retVal;

			retVal["cache"]["tagName"] = tagName;

			var persistentId = this.getObjectPersistentId(obj);
			retVal["cache"][this.persistentIdName] = persistentId;

			retVal["cache"]["className"] = obj["className"] || "";
			retVal["cache"]["id"] = obj["id"] || "";

			if ((getterName != "") && (getterName != "parentNode")) {
				var parentNode = obj["parentNode"];
				if (typeof (parentNode) == "object")
					retVal["cache"]["parentNode"] = this.cacheObject(parentNode, objectMoniker, "parentNode", depth);
			}

			if (nodeName == "TD") {
				retVal["cache"]["cellIndex"] = obj["cellIndex"];
			} else if (nodeName == "TR") {
				retVal["cache"]["rowIndex"] = obj["rowIndex"];
			}

			retVal["cache"]["$nodeInfo"] = this.getNodeInfo(obj);

			var attributes = obj["attributes"];
			if ((typeof (attributes) == "object") && (attributes != null))
				retVal["cache"]["attributes"] = this.cacheObject(attributes, objectMoniker, "attributes", depth);
			else
				retVal["cache"]["#has,\"attributes\""] = 0;

			retVal["cache"]["role"] = obj["role"] || "";

			if (tagName.toUpperCase() == "IMG") {
				retVal["cache"]["useMap"] = obj["useMap"] || "";
				retVal["cache"]["src"] = obj["src"] || "";
			}

			return retVal;
		},

		revokeObject: function (objectId) {
			if ((typeof (objectId) != "number") || (objectId == 0))
				return;

			this.objectCache[objectId] = 0;
			this.objectMonikerCache[objectId] = "";

			if (((this.nextCacheIdStep < 0) && (objectId > 0)) ||
				((this.nextCacheIdStep > 0) && (objectId < 0)))
				return;

			this.freeIndexes.push(objectId);
		},

		getObjectFromCache: function (objectId) {
			if (typeof (objectId) != "number") {
				if ((typeof (objectId) == "string") && (objectId != "")) {
					try {
						return this.returnObject(objectId);
					} catch (e) {
						console.error(e);
					}
				}
				return null;
			}

			if (objectId == this.OBJECTID_NULL)
				return null;

			if (objectId == this.OBJECTID_WINDOW)
				return (typeof window == "undefined") ? self : window;

			if (objectId == this.OBJECTID_CONTEXT)
				return this.context;

			if (objectId == this.OBJECTID_AGENT)
				return (typeof window == "undefined") ? self[this.contentAgentName] : window[this.contentAgentName];

			if (objectId == this.OBJECTID_IOCM)
				return this;

			var obj = this.objectCache[objectId];
			if ((obj === undefined) || (typeof (obj) == "number"))
				return null;
			return obj;
		},

		getTypeMoniker: function (obj) {

			if (!this.isObject(obj) || (obj === null))
				return "";

			if (typeof (obj["nodeType"]) == "number")
				return "";

			var typeMoniker = obj.constructor != null ? obj.constructor.name + "" : "";
			if ((typeMoniker == "") && (obj.constructor != null))
				typeMoniker = obj.constructor.toString();

			return typeMoniker;
		},

		addNameToNamespace: function (obj, name, value) {
			if (!this.inSandbox())
				return;

			var typeMoniker = this.getTypeMoniker(obj);
			if (typeMoniker == "")
				return;

			if ((typeMoniker == "Array") && (name != "toString") && (name != "item") && (name != "length"))
				return;

			if (typeof (this.cachedNamespaces[typeMoniker]) != "object")
				this.cachedNamespaces[typeMoniker] = {};

			if ((typeof (this.cachedNamespaces[typeMoniker][name]) != "number") ||
				(this.cachedNamespaces[typeMoniker][name] == -1)) {
				this.cachedNamespaces[typeMoniker][name] = value;
			}
		},

		hasProperty: function (name, iocm) {
			if (this === null)
				return 0;

			if ((typeof (iocm) == "object") && (iocm != null))
				iocm.addNameToNamespace(this, name, -1);

			if (!this.propertyIsEnumerable(name) && !(name in this))
				return 0;

			if (typeof (this[name]) != "function")
				return 1;

			return 2;
		},

		isCachable: function (obj) {
			if (obj === undefined)
				return false;

			var typeName = typeof (obj);
			if ((typeName == "string") || (typeName == "number") || (typeName == "boolean"))
				return false;

			return true;
		},

		getBounds: function () {

			var inDocumentNodeHidden = function (node) {

				if (!node || node.hidden === true)
					return true;

				var style = window.getComputedStyle(node, '');
				if (style && style.getPropertyValue('display') === 'none')
					return true;
				if (style && style.getPropertyValue('visibility') === 'hidden')
					return true;
				return false;
			};

			var rect = this.getBoundingClientRect();
			return JSON.stringify({ "inDocumentNodeHidden": inDocumentNodeHidden(this), "left": rect.left, "top": rect.top, "width": rect.width, "height": rect.height });
		},

		encodeParam: function (value, parentMoniker, getterName, depth) {

			if (this.isCachable(value)) {

				value = this.cacheObject(value, parentMoniker, getterName, depth);

			} else if (typeof (value) == "number") {

				if (isNaN(value))
					value = { "constId": 1 };
				else if (value == Infinity)
					value = { "constId": 2 };
				else if (value == -Infinity)
					value = { "constId": 3 };
			} else if (value === undefined) {
				value = { "constId": 0 };
			}

			return value;
		},

		decodeConst: function (constId) {

			if (constId == 0)
				return undefined;
			else if (constId == 1)
				return NaN;
			else if (constId == 2)
				return Infinity;
			else if (constId == 3)
				return -Infinity;
			else
				return null;
		},

		decodeParam: function (param) {

			if (typeof (param) == "object") {

				if (typeof (param["objectId"]) != "undefined")
					return this.getObjectFromCache(param["objectId"]);
				if (typeof (param["constId"]) != "undefined")
					return this.decodeConst(param["constId"]);
			}
			return param;
		},

		createParamMoniker: function (param) {

			if (typeof (param) == "object") {

				if (typeof (param["objectId"]) != "undefined")
					return this.getObjectMoniker(param["objectId"]);
				if (typeof (param["constId"]) != "undefined")
					return this.decodeConst(param["constId"]);
			} else if (typeof (param) == "string")
				return JSON.stringify(param);
			return param;
		},

		createRetVal: function (value, parentMoniker, getterName) {
			return { "retVal": this.encodeParam(value, parentMoniker, getterName, 0) };
		},

		createError: function (callData, errorCode) {
			// console.log(`Invoke has thrown an error ${errorCode} on call: ${JSON.stringify(callData)}`);
			return { "errorCode": errorCode, "retVal": 0 };
		},


		invoke: function (callData) {
			try {

				if (!callData || (typeof (callData) != "object"))
					return this.createError(callData, "invalid callData");

				var methodName = callData["method"] || "";
				var flags = callData["flags"];

				if ((flags == 2) && (methodName == "#batchRelease")) {
					var params = callData["params"];
					for (var i = 0; i < params.length; i++)
						this.revokeObject(params[i]);
					return null;
				}

				var objectId = callData["objectId"] || 0;
				var callObject = this.getObjectFromCache(objectId);
				if (callObject === null)
					return this.createError(callData, "invalid call object");

				if (flags == 0) // get property
				{
					return this.createRetVal(callObject[methodName], this.getObjectMoniker(objectId), methodName);
				}

				if (flags == 1) // put property
				{
					var params = callData["params"];
					if (typeof (params) != "object")
						return this.createError(callData, "invalid call params");

					callObject[methodName] = this.decodeParam(params[0]);
					return null;
				}

				if (flags == 2) // call method
				{
					var params = callData["params"];
					if (typeof (params) != "object")
						return this.createError(callData, "invalid call params");

					var methodMoniker = methodName + "(";
					for (var i = 0; i < params.length; i++) {
						methodMoniker += this.createParamMoniker(params[i]);
						if (i != params.length - 1) methodMoniker += ", ";
						params[i] = this.decodeParam(params[i]);
					}
					methodMoniker += ")";

					var func = null;

					if (methodName == "#has") {

						func = this.hasProperty;
						params = [params[0], this];

					} else if (methodName == "#getbounds") {

						func = this.getBounds;
					} else if (methodName == "#addWebHelpers") {
						func = webHelpersStart;
					} else {

						if (methodName != "") {
							func = callObject[methodName];
						} else {
							func = callObject;
						}
					}

					if (typeof (func) != "function")
						return this.createError(callData, "invalid function");

					var funcRetVal = null;
					try {
						funcRetVal = func.apply(callObject, params);
					} catch (e) {
						console.trace(e);
					}

					return this.createRetVal(funcRetVal, null, this.getObjectMoniker(objectId) + "." + methodMoniker);
				}

				return this.createError(callData, "invalid call flags");
			} catch (e) {
				console.trace(e);
				return this.createError(callData, "exception: " + e);
			}
		},
		
		returnObject: function(string){
			if (string == null || string === "" || string === "undefined")
				return undefined;

			let d;
			[string, args] = this.getArgs(string);
			[string, items] = this.getItems(string);
			string.split(".").map((e, k) => {
				if(k == 0) d = window[e];
				else{
					if(e.includes("*")){
						const index = Number(e.match(/(?<=[*]).*?(?=[*])/gm)[0].replaceAll("*", ""));
						const method = e.replace(`*${index}*`, '');
						d = d[method](args[index]);
					}else if(e.includes("|")){
						const index = Number(e.match(/(?<=[|]).*?(?=[|])/gm)[0].replaceAll("|", ""));
						const method = e.replace(`|${index}|`, '');
						d = d[method][items[index]];
					}
					else{
						d = d[e]
					}
				}
			})
			return d;
		},

		getArgs: function(string){
			let args = string.match(/(?<=[(]).*?(?=[)])/gm);
			if(!args) return [string, args];
			args.map((e, k) => string = string.replace(`(${e})`, `*${k}*`));
			args = args.map(e => e.replaceAll("'","").replaceAll('"', ''));
			return [string, args];
		},

		getItems: function(string){
			let items = string.match(/(?<=[\[]).*?(?=[\]])/g);
			if(!items) return [string, items];
			items.map((e, k) => string = string.replace(`[${e}]`, `|${k}|`).replace(`['${e}']`, `|${k}|`));
			items = items.map(e => e.replaceAll("'","").replaceAll('"', ''));
			return [string, items]; 
		}
	};
