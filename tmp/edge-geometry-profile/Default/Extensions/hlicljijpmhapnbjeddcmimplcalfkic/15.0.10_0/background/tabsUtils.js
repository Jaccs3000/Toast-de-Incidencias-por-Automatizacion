//public:
//    function getTabInfos()
//    function getTabExists(tabId);
//    function isTabInLoadingState(tabId)
//    function getTabUrl(tabId)
//    function setTabUrl(tabId, absoluteUrl, selectTab)
//    function activateTab(tabId)
//    function getTabWindowInfo(tabId, onlyIfSelected)
//    function closeTab(tabId) // NEW IN TC9
//
//internal:
//    function addTabsListener(key, listener)
//    function removeTabsListener(key)
//
//private:
//    var gTabInfos
//    var gTabsListeners
//    function addTabInfo(tab, tabWindow)
//    function isTabLoadingState(tabStatus)
//    function tabInfo2Str(tabId, tabInfo)
//    function fireOnTabCreated(tabId)
//    function fireOnTabRemoved(tabId, isWindowClosing)
//    function fireOnTabUpdated(tabId)

//Sync with tabsUtils.js.h
cTabWindowInfoUndefined = "<undefined>";
cTabWindowTypeUndefined = "<unknown-tab-window-type>"

var gTabInfos = {};

function markSelected(tabId, windowId)
{
    for (var t in gTabInfos)
    {
        var tabInfo = gTabInfos[t];
        if (tabInfo !== undefined)
        {
            if (tabInfo.windowId == windowId)
            {
                if (t != tabId)
                    tabInfo.selected = false;
            }
        }
    }
}

function addTabInfo(tab, tabWindow)
{
    var tabInfo = {};
    tabInfo.status = tab.status;
    tabInfo.url = tab.url;
    tabInfo.selected = tab.active;
    tabInfo.windowId = tabWindow.id;
    tabInfo.windowType = tabWindow.type;
    tabInfo.windowLeft = tabWindow.left;
    tabInfo.windowTop = tabWindow.top;
    tabInfo.windowWidth = tabWindow.width;
    tabInfo.windowHeight = tabWindow.height;
    tabInfo.debuggerAttached = false;
    tabInfo.deviceScaleFactor = 1.0;
    gTabInfos[tab.id] = tabInfo;
    
    if (tabInfo.selected)
        markSelected(tab.id, tabInfo.windowId);
}

function isTabLoadingState(tabStatus)
{
    return tabStatus == "loading";
}

function tabInfo2Str(tabId, tabInfo)
{
    var loadingState;
    if (isTabLoadingState(tabInfo.status))
        loadingState = 1;
    else
        loadingState = 0;
    var windowType;
    
    var windowType;
    if (tabInfo.windowType !== undefined)
        windowType = tabInfo.windowType;
    else
        windowType = cTabWindowTypeUndefined;

    return tabId + "\n" + tabInfo.windowId + "\n" + windowType + "\n" + loadingState + "\n" + tabInfo.url;
}

var gTabsListeners = {};

function addTabsListener(key, listener)
{
    gTabsListeners[key] = listener;
}

function removeTabsListener(key)
{
    delete gTabsListeners[key];
}

function fireOnTabCreated(tabId)
{
    for(var key in gTabsListeners)
        gTabsListeners[key].onTabCreated(tabInfo2Str(tabId, gTabInfos[tabId]));
}

function fireOnTabRemoved(tabId, isWindowClosing)
{
    for(var key in gTabsListeners)
        gTabsListeners[key].onTabRemoved(tabId, isWindowClosing);
}

function fireOnTabUpdated(tabId)
{
    for(var key in gTabsListeners)
        gTabsListeners[key].onTabUpdated(tabInfo2Str(tabId, gTabInfos[tabId]));
}

function fireOnTabContentStateChanged(tabId)
{
    if (!gTabInfos[tabId].selected)
        return;

    for(var key in gTabsListeners)
        gTabsListeners[key].onTabContentStateChanged(tabInfo2Str(tabId, gTabInfos[tabId]));
}

//code
//{
function safe_chrome_windows_get(windowId, callback)
{
    chrome.windows.get
    (
        windowId,
        function(w)
        {
            if (w !== undefined)
                callback(w);
            else
                console.trace(chrome.runtime.lastError.message);
        }
    );
}
chrome.tabs.onCreated.addListener
(
    function(tab)
    {
        safe_chrome_windows_get
        (
            tab.windowId,
            function(w)
            {
                addTabInfo(tab, w);
                fireOnTabCreated(tab.id);
            }
        );
    }
); 
chrome.tabs.onRemoved.addListener
(
    function(tabId, removeInfo)
    {
        if (gTabInfos[tabId] !== undefined)
        {
            delete gTabInfos[tabId];
            var isWindowClosing = false;
            if (removeInfo.isWindowClosing)
                isWindowClosing = true;
            fireOnTabRemoved(tabId, isWindowClosing);
        }
    }
);
// ADX0324853
// http://crbug.com/226180
if (chrome.tabs.onReplaced)
    chrome.tabs.onReplaced.addListener
    (
        function(addedTabId, removedTabId)
        {
            if (gTabInfos[removedTabId] !== undefined)
            {
                delete gTabInfos[removedTabId];
                fireOnTabRemoved(removedTabId, false);
            }

            chrome.tabs.get
            (
                addedTabId,
                function(tab)
                {
                    safe_chrome_windows_get
                    (
                        tab.windowId,
                        function(w)
                        {
                            var fireCreated = (gTabInfos[addedTabId] === undefined);
                            addTabInfo(tab, w);
                            if (fireCreated)
                                fireOnTabCreated(addedTabId);
                        }
                    );
                }
            );
        }
    );
// }
chrome.tabs.onUpdated.addListener
(
    function(tabId, changeInfo, tab)
    {
        var tabInfo = gTabInfos[tabId];
        if (tabInfo !== undefined)
        {
            if (changeInfo.status !== undefined)
                tabInfo.status = changeInfo.status;
            if (changeInfo.url !== undefined)
                tabInfo.url = changeInfo.url;
            fireOnTabUpdated(tabId);
        }
        // ADX0176157
        // {
        else
        {
            safe_chrome_windows_get
            (
                tab.windowId,
                function(w)
                {
                    addTabInfo(tab, w);
                    fireOnTabCreated(tabId);
                    
                    var tabInfo = gTabInfos[tabId];
                    if (changeInfo.status !== undefined)
                        tabInfo.status = changeInfo.status;
                    if (changeInfo.url !== undefined)
                        tabInfo.url = changeInfo.url;
                    fireOnTabUpdated(tabId);
                }
            );
        }
        // }
    }
);
chrome.tabs.onDetached.addListener
(
    function(tabId, detachInfo)
    {
        var tabInfo = gTabInfos[tabId];
        if (tabInfo !== undefined)
        {
            tabInfo.windowId = chrome.windows.WINDOW_ID_NONE;
            tabInfo.windowType = undefined;
            tabInfo.windowLeft = 0;
            tabInfo.windowTop = 0;
            tabInfo.windowWidth = 0;
            tabInfo.windowHeight = 0;
            
            fireOnTabUpdated(tabId);
        }
    }
);
chrome.tabs.onAttached.addListener
(
    function(tabId, attachInfo)
    {
        safe_chrome_windows_get
        (
            attachInfo.newWindowId,
            function(w)
            {
                var tabInfo = gTabInfos[tabId];
                if (tabInfo !== undefined)
                {
                    tabInfo.windowId = w.id;
                    tabInfo.windowType = w.type;
                    tabInfo.windowLeft = w.left;
                    tabInfo.windowTop = w.top;
                    tabInfo.windowWidth = w.width;
                    tabInfo.windowHeight = w.height;
                    
                    fireOnTabUpdated(tabId);
                }
            }
        );
    }    
);
chrome.tabs.onActivated.addListener
(
    function(activeInfo)
    {
        var tabInfo = gTabInfos[activeInfo.tabId];
        if (tabInfo !== undefined)
        {
            tabInfo.selected = true;
            markSelected(activeInfo.tabId, tabInfo.windowId);
        }
    }
);
chrome.windows.getAll
(
    { populate: true },
    function(windows)
    {
        if (windows !== undefined)
            for (var w in windows)
            {
                var tabs = windows[w].tabs;
                if (tabs !== undefined)
                    for (var t in tabs)
                        addTabInfo(tabs[t], windows[w]);
            }
    }
)
//}

function getTabInfos()
{
    var result = "";
    for(var tabId in gTabInfos)
        result += tabInfo2Str(tabId, gTabInfos[tabId]) + "\n";
    return result;
}

function getTabExists(tabId)
{
    var tabInfo = gTabInfos[tabId];
    return tabInfo !== undefined;
}

function isTabInLoadingState(tabId)
{
    var tabInfo = gTabInfos[tabId];
    if (tabInfo !== undefined)
        return isTabLoadingState(tabInfo.status);
    else
        return false;
}

function getTabUrl(tabId)
{
    var tabInfo = gTabInfos[tabId];
    if (tabInfo !== undefined)
        return tabInfo.URL;
    else
        return "";
}

function setTabUrl(tabId, absoluteUrl, selectTab)
{
    var updateProperties = { url: absoluteUrl };
    if (selectTab)
    {
        updateProperties.active = selectTab;
        updateProperties.selected = selectTab;
        updateProperties.highlighted = selectTab;
    }

    chrome.tabs.update(tabId, updateProperties, undefined);
}

function activateTab(tabId)
{
    if (gTabInfos[tabId] && gTabInfos[tabId].windowId >= 0)
        chrome.windows.update(gTabInfos[tabId].windowId, { "focused": true });

    var updateProperties = { selected: true, highlighted: true, active: true };
    chrome.tabs.update(tabId, updateProperties, undefined);
}

function getTabWindowInfo(tabId, onlyIfSelected)
{
    var tabInfo = gTabInfos[tabId];
    if (tabInfo !== undefined)
    {
        if (onlyIfSelected && !tabInfo.selected)
            return cTabWindowInfoUndefined;
        else
            return tabInfo.windowLeft + " " + tabInfo.windowTop + " " + tabInfo.windowWidth + " " + tabInfo.windowHeight;
    }
    else
        return cTabWindowInfoUndefined;
}

function closeTab(tabId)
{
    chrome.tabs.remove(tabId);
}

var g_windowMonitor = null;
function startWindowMonitor(interval)
{
    g_windowMonitor = setInterval
    (
        function()
        {
            chrome.windows.getAll
            (
                { populate: true },
                function(windows)
                {
                    if (windows !== undefined)
                    {
                        var windowInfos = {};
                        for (var w in windows)
                        {
                            var windowObj = windows[w]; 
                            var windowInfo = {};
                            windowInfo.windowType = windowObj.type;
                            windowInfo.windowLeft = windowObj.left;
                            windowInfo.windowTop = windowObj.top;
                            windowInfo.windowWidth = windowObj.width;
                            windowInfo.windowHeight = windowObj.height;
                            windowInfos[windowObj.id] = windowInfo;
                        }
                        for(var tabId in gTabInfos)
                        {
                            var tabInfo = gTabInfos[tabId];
                            var windowInfo = windowInfos[tabInfo.windowId];
                            if (windowInfo)
                            {
                                tabInfo.windowType = windowInfo.windowType;
                                tabInfo.windowLeft = windowInfo.windowLeft;
                                tabInfo.windowTop = windowInfo.windowTop;
                                tabInfo.windowWidth = windowInfo.windowWidth;
                                tabInfo.windowHeight = windowInfo.windowHeight;
                            }
                        }
                    }
                }
            );
        }
        ,
        interval
    );
}

function stopWindowMonitor()
{
    clearInterval(g_windowMonitor);
}

// Debugger helpers

chrome.debugger.onDetach.addListener(onDebuggerDetach);

function onDebuggerDetach(debuggeeId)
{
    var tabInfo = gTabInfos[debuggeeId.tabId];
    tabInfo.debuggerAttached = false;
    console.log('Debugger detached from the tab with id: ' + debuggeeId.tabId);
}

function onDebuggerAttach(debuggeeId, callback)
{
    var errorMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : "";

    var tabInfo = gTabInfos[debuggeeId.tabId];
    if (tabInfo)
        tabInfo.debuggerAttached = (errorMsg == "");

    if (errorMsg)
    {
        console.log(errorMsg);
        return;
    }

    chrome.debugger.sendCommand(debuggeeId, 'Network.enable');
    chrome.debugger.sendCommand(debuggeeId, 'Page.enable');
    if (callback) callback();
}

function attachDebugger(tabId, callback)
{
    var debuggeeId = {'tabId': tabId};
    chrome.debugger.attach(debuggeeId, '1.1', onDebuggerAttach.bind(null, debuggeeId, callback));
}

function detachDebugger(tabId)
{
    var debuggeeId = {'tabId': tabId};
    chrome.debugger.detach(debuggeeId, onDebuggerDetach.bind(null, debuggeeId));
}

function sendDebuggerCommand(tabId, command, paramsJSON)
{
    var tabInfo = gTabInfos[tabId];
    if (tabInfo && !tabInfo.debuggerAttached)
    {
        attachDebugger(tabId, sendDebuggerCommand.bind(null, tabId, command, paramsJSON));
        return;
    }

    try {
        var params = JSON.parse(paramsJSON);
        chrome.debugger.sendCommand({'tabId': tabId}, command, params);

        if (tabInfo && (command == "Emulation.setDeviceMetricsOverride"))
            tabInfo.deviceScaleFactor = params.deviceScaleFactor / devicePixelRatio;
    }
    catch (e) {
        console.trace(e)
    }
}

chrome.webNavigation.onBeforeNavigate.addListener
(
    function(details)
    {
        if (details && details.tabId && details.frameId === 0)
        {
            var tabInfo = gTabInfos[details.tabId];
            if (tabInfo)
                tabInfo.status = "loading";
        }
    }
)

chrome.webNavigation.onErrorOccurred.addListener
(
    function(details)
    {
        if (details && details.tabId && details.frameId === 0)
        {
            var tabInfo = gTabInfos[details.tabId];
            if (tabInfo)
                tabInfo.status = "";
        }
    }
)
