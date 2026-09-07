const vtIntegration = {
	querySelector : function(selector){
		let element = document.querySelector(selector);
		return (element !== null && element !== undefined) ? 'ok' : 'nok' ;
	},
	scrollPixels : function(pixels){
		document.body.style.transform=`translateY(${pixels}px)`;
	},
	scrollTo : function(x,y){
		window.scrollTo(x,y);
	},
	clearIgnoredElements : function(){
		delete window.sbvt;
	},
	injectIgnoredElements : function(elems){
		window.sbvt = { ignoreElements: [elems] };
	},
	fixedElementsUp : function(){
		document.body.style.transform = "";
	},
	fixedElementsDown : function(){
		document.body.style.transform = "translateY(0)";
	},
	scrollbarOn : function(){
		document.body.style.overflow="";
	},
	scrollbarOff : function(){
		document.body.style.overflow="hidden";
	},
	freezeAnimations : function(){
		let e = 0;
		let t = function(t) {
			var a = /^(?!data:).*\.gif/i.test(t.src);
			if (a) {
				void 0;
				e++
			}
			return a
		};
		let a = function(e) {
			var t = document.createElement("canvas");
			var a = t.width = e.width;
			var r = t.height = e.height;
			t.getContext("2d").drawImage(e, 0, 0, a, r);
			try {
				e.src = t.toDataURL("image/gif")
			} catch (a) {
				for (var i = 0, n; n = e.attributes[i]; i++);
				e.parentNode.replaceChild(t, e)
			}
		};
		let r = function() {
			[].slice.apply(document.images).filter(t).map(a);
			return e
		};
		let i = function() {
			var e = document.getElementsByTagName("*");
			let t = 0;
			for (var a = 0; a < e.length; a++) {
				var r = e[a];
				try {
					var i = window.getComputedStyle(r, null).getPropertyValue("animation-duration");
					if (parseInt(i) > 0) {
						r.style.animationDuration = "0s";
						t++;
						void 0
					}
				} catch (e) {}
			}
			return t
		};
		let n = function() {
			if (window.jQuery) {
				void 0;
				jQuery.fx.off = true
			}
		};
		let o = function(e) {
			return e.tagName + (e.id ? "#" + e.id : e.className ? "." + e.className : "")
		};
		let c = function() {
			const e = document.querySelectorAll("video");
			let t = 0;
			if (e.length) e.forEach((e => {
				if (e.currentTime !== 0) {
					t++;
					if (!e.loop && e.duration < 10) {
						void 0;
						e.pause();
						e.autoplay = false;
						e.currentTime = e.duration
					} else {
						void 0;
						e.pause();
						e.autoplay = false;
						e.currentTime = 0
					}
				}
			}));
			return t
		};
		const l = () => {
			const e = document.querySelectorAll("*");
			let t = 0;
			e.forEach((e => {
				const a = window.getComputedStyle(e).getPropertyValue("background-image");
				if (a.includes(".gif")) try {
					const r = new Image;
					r.src = a.replace(/url\(['"]?/g, "").replace(/['"]?\)/g, "");
					const i = document.createElement("canvas");
					i.width = r.width;
					i.height = r.height;
					const n = i.getContext("2d");
					n.drawImage(r, 0, 0, r.width, r.height);
					const o = i.toDataURL("image/gif");
					if (!r.width || !r.height) throw Error('Issue handling background gif â€” likely chrome issue from enabling "disable cache".))');
					e.style.backgroundImage = `url(${o})`;
					void 0;
					t++
				} catch (e) {
					void 0
				}
			}));
			return t
		};
		n();
		return JSON.stringify({
				totalFrozen: {
					gifs: r(),
					bgGifs: l(),
					animations: i(),
					videos: c()
				}
		});
	},
	getDom : function(){
		try {
			let e = {
				error: false,
				viewport: {
					left: null,
					top: null,
					width: null,
					height: null
				},
				fullpage: {
					width: null,
					height: null
				},
				version: "1.1.1",
				url: window.location.href,
				devicePixelRatio: null,
				ignoredElementsData: [],
				dom: []
			};
			let t = {
				elements: 0,
				objects: 0
			};
			let r = ["script", "param"];
			let o = ["noscript", "option"];
			let n = e.dom;
			let i = [];
			let l = e => {
				if (e.nodeType == Node.ELEMENT_NODE)
					if (r.indexOf(e.tagName.toLowerCase()) > -1) return NodeFilter.FILTER_REJECT;
					else if (o.indexOf(e.tagName.toLowerCase()) > -1) return NodeFilter.FILTER_SKIP;
				else return NodeFilter.FILTER_ACCEPT;
				else if (e.nodeType == Node.TEXT_NODE)
					if (e.textContent.trim()) return NodeFilter.FILTER_ACCEPT
			};
			let d = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_TEXT, l, false);
			let a = e => {
				try {
					attributes = e.getAttributeNames();
					return attributes
				} catch (e) {
					return "failed"
				}
			};
			let c = (e, t) => {
				try {
					return e.getAttribute(t)
				} catch (e) {
					return "failed"
				}
			};
			let u = (e, t, r = null) => {
				try {
					if (window.getComputedStyle) return document.defaultView.getComputedStyle(e, r).getPropertyValue(t);
					else if (e.currentStyle) return e.currentStyle[t];
					else return ""
				} catch (e) {
					return "failed"
				}
			};
			let s = e => {
				var t = e.getBoundingClientRect(),
					r = document.body,
					o = document.documentElement,
					n = window.pageYOffset || o.scrollTop || r.scrollTop,
					i = window.pageXOffset || o.scrollLeft || r.scrollLeft,
					l = o.clientTop || r.clientTop || 0,
					d = o.clientLeft || r.clientLeft || 0,
					a = t.top + n - l,
					c = t.left + i - d,
					u = t.right - t.left,
					s = t.bottom - t.top;
				return {
					top: Math.round(a),
					left: Math.round(c),
					width: Math.round(u),
					height: Math.round(s)
				}
			};
			let f = e => {
				String.prototype.correctWhiteSpace = function() {
					return this.replace(/\s+/g, " ")
				};
				return typeof e == "string" ? e.correctWhiteSpace().trim() : ""
			};
			let h = () => {
				var e = {
					left: window.scrollX,
					top: window.scrollY,
					width: window.innerWidth,
					height: window.innerHeight
				};
				return e
			};
			let m = () => ({
				width: Math.max(window.document.body.offsetWidth, window.document.body.scrollWidth, window.document.documentElement.offsetWidth, window.document.documentElement.scrollWidth),
				height: Math.max(window.document.body.offsetHeight, window.document.body.scrollHeight, window.document.documentElement.offsetHeight, window.document.documentElement.scrollHeight)
			});
			let g = (e, t, r) => {
				let o = null;
				switch (t) {
					case "before":
					case "after":
						if (u(e, "content", `::${t}`) !== "none") {
							o = {};
							r.push("content", "width", "height");
							if (u(e, "position", `::${t}`) !== "static") r.push("top", "bottom", "left", "right");
							r.forEach((r => {
								o[r] = u(e, r, `::${t}`)
							}))
						}
						break;
					case "marker":
						if (u(e, "width", "::marker") != "auto") {
							o = {};
							const t = ["content", "font-size", "color", "width", "height"];
							t.forEach((t => {
								o[t] = u(e, t, "::marker")
							}))
						}
						break
				}
				return o
			};
			let w = (r = false) => {
				let o = false;
				let l;
				i.forEach((e => {
					if (d.currentNode === e.node) {
						l = e.cssSelector;
						o = true
					}
				}));
				t.elements++;
				let h = n;
				let m = null;
				if (d.currentNode.nodeType == Node.ELEMENT_NODE) {
					var p = s(d.currentNode);
					var E = {
						top: p.top,
						left: p.left,
						width: p.width,
						height: p.height
					};
					var N = {};
					var b = {};
					var y = {
						before: null,
						after: null,
						marker: null
					};
					var T = a(d.currentNode);
					T.forEach((e => {
						b[e] = c(d.currentNode, e)
					}));
					var v = ["background-repeat", "background-origin", "background-position", "background-color", "background-image", "background-size", "border-width", "border-color", "border-style", "color", "display", "font-family", "font-style", "box-shadow", "font-size", "font-weight", "line-height", "margin", "opacity", "overflow", "padding", "visibility", "text-align", "position", "border-radius", "z-index"];
					v.forEach((e => {
						N[e] = u(d.currentNode, e)
					}));
					y.before = g(d.currentNode, "before", v);
					y.after = g(d.currentNode, "after", v);
					if (N.display == "list-item") y.marker = g(d.currentNode, "marker");
					m = h.push({
						domId: t.elements,
						tagname: f(d.currentNode.tagName),
						box: E,
						styles: N,
						attrs: b,
						pseudo: y,
						ignore: o || r,
						children: []
					});
					if (o) e.ignoredElementsData.push({
						domId: t.elements,
						tagname: f(d.currentNode.tagName),
						cssSelector: l,
						box: E
					})
				} else if (d.currentNode.nodeType == Node.TEXT_NODE) m = h.push({
					domId: t.elements,
					tagname: "text",
					value: d.currentNode.textContent.trim(),
					ignore: o || r
				});
				if (d.firstChild()) {
					n = h[m - 1].children;
					w(o || r)
				}
				if (d.nextSibling()) {
					n = h;
					w(r)
				} else {
					d.parentNode();
					return
				}
			};
			let p = () => {
				if (Array.isArray(window.sbvt && window.sbvt.ignoreElements)) {
					i = [];
					window.sbvt.ignoreElements.forEach((e => {
						let t = document.querySelectorAll(e);
						t.forEach((t => {
							i.push({
								cssSelector: e,
								node: t
							})
						}))
					}));
					void 0
				}
			};
			e.viewport = h();
			e.fullpage = m();
			e.devicePixelRatio = window.devicePixelRatio;
			p();
			w();
			error = e.dom.length == 0;
			return JSON.stringify(e)
		} catch (e) {
			void 0;
			return JSON.stringify({
				error: true,
				message: e.message
			})
		}	
	},
	getPageDimensions: function(){
			return JSON.stringify({
				"document": {
					"height": document.documentElement.clientHeight,
					"width": document.documentElement.clientWidth
				},
				"body": {
					"height": document.body.clientHeight,
					"width": document.body.clientWidth
				},
				"windowInner": {
					"height": window.innerHeight,
					"width":  window.innerWidth
				},
				"fullpage": {
					"height": Math.max(window.document.body.offsetHeight,window.document.body.scrollHeight, window.document.documentElement.offsetHeight, window.document.documentElement.scrollHeight),
					"width": Math.max(window.document.body.offsetWidth, window.document.documentElement.offsetWidth)
				},
				"devicePixelRatio": window.devicePixelRatio,
				"initialScroll": {
					x: window.scrollX, 
					y: window.scrollY
				}
			});
	},
	getPageState : function(){		
			return JSON.stringify({
					"scrollX": window.scrollX, 
					"scrollY": window.scrollY,
					"overflow": document.body.style.overflow,
					"transform": document.body.style.transform
				});
	},
	getUserAgent : function(){
			return	JSON.stringify((function() {
					function e(e, n) {
						this.name = e;
						this.pattern = n
					}
					e.prototype.match = function e(n) {
						var i = n.match(this.pattern);
						if (i === null) return null;
						var r = {
							name: this.name,
							version: null
						};
						if (typeof i[1] !== "undefined") r.version = i[1].replace(/_/g, ".");
						return r
					};
					var n = [new e("Firefox", /Firefox\/([0-9.]+)/), new e("Edge", /Edg[AeiOS]{0,3}\/([0-9.]+)/), new e("Opera", /OPR\/([0-9.]+)/), new e("SamsungInternet", /SamsungBrowser\/([0-9.]+)/), new e("UCBrowser", /UCBrowser\/([0-9.]+)/), new e("Chrome", /Chrome\/([0-9.]+)/), new e("Safari", /Version\/([0-9.]+)(?: .*)? Safari\//), new e("InternetExplorer", /(?:MSIE |IEMobile\/|Trident\/.*rv:)([0-9.]+)/)];
					var i = [new e("Windows", /Windows NT ([0-9.]+)/), new e("Windows Phone", /Windows Phone ([0-9.]+)/), new e("MacOS", /OS X ([0-9._]+)/), new e("iPad", /iPad.+?OS ([0-9_,]+)/), new e("iPhone", /iPhone OS ([0-9_.]+)/), new e("ChromeOS", /CrOS [^ ]+ ([0-9.]+)/), new e("Android", /(?:Android|Adr) ([0-9.]+)/), new e("BlackBerry", /BlackBerry|BB10/), new e("webOS", /webOS\/([0-9.]+)/), new e("Linux", /Linux/)];
					var r = {
						osName: "",
						osVersion: "",
						browserName: "",
						browserVersion: "",
						screenWidth: "",
						screenHeight: "",
						devicePixelRatio: "",
						deviceType: "",
						deviceName: ""
					};

					function o(e) {
						var o = typeof e === "string" ? e : window.navigator.userAgent,
							a = false,
							s, t;
						for (t = 0; t < n.length; t++) {
							s = n[t].match(o);
							if (s !== null) {
								r.browserName = s.name.toLowerCase();
								r.browserVersion = s.version;
								a = true;
								break
							}
						}
						for (t = 0; t < i.length; t++) {
							s = i[t].match(o);
							if (s !== null) {
								r.osName = s.name.toLowerCase();
								void 0;
								if (r.osName == "iphone") {
									r.osName = "ios";
									r.deviceName = "iphone"
								}
								if (r.osName == "ipad") {
									r.osName = "ios";
									r.deviceName = "ipad"
								}
								r.osVersion = s.version;
								r.deviceType = ["android", "ios", "BlackBerry", "Windows Phone"].includes(r.osName) ? "mobile" : "desktop";
								break
							}
						}
						r.screenWidth = window.screen.width;
						r.screenHeight = window.screen.height;
						r.orientation = window.screen.width > window.screen.height ? "landscape" : "portrait";
						r.devicePixelRatio = window.devicePixelRatio || 1;
						return a
					}
					o();
					return r
				})());
	},
	captureViolations: function() {
		let getBoundingBox = (node) => {
			let element = document.querySelector(node["target"][0]);  
			if (element) {
				let rect = element.getBoundingClientRect();  
				return {
					"x": rect.x,
					"y": rect.y,
					"width": rect.width,
					"height": rect.height,
					"target": node["target"][0],
					"html": node["html"]
				};
			}
			return null;
		}
		
		let getAccessibilityViolationSummary = (violation, node) => {
			let boundingBox = getBoundingBox(node); 
			return {
				"description": violation["description"],
				"help": violation["help"],
				"helpUrl": violation["helpUrl"],
				"id": violation["id"],
				"impact": violation["impact"],
				"boundingBox": boundingBox
			}; 
		}
		
		if (typeof window === 'undefined') return "";
		window['$violations'] = "";
		axe
		.run()
		.then(results => {
			if (results.violations.length) {
				console.log("Accessibility violations found.");
				let violationRules = [];
				for (let violation of results["violations"]) {
					for (let node of violation["nodes"]) {
						let violationRuleSummary = getAccessibilityViolationSummary(violation, node);
						violationRules.push(violationRuleSummary);  
					}
				}
				window['$violations'] = JSON.stringify(violationRules);
			} else {
				console.log("No accessibility violations found.");
				window['$violations'] = "";
			}
		})
		.catch(err => {
			console.error('Error:', err.message);
			window['$violations'] = "error : " + err.message;
		});
	},
	getViolation: function() {
		if (typeof window === 'undefined') return "error : window object undefined";

		if (window['$violations'] === undefined) {
			return "not ready";
		} else {
			return window['$violations'];
		}
	}
};