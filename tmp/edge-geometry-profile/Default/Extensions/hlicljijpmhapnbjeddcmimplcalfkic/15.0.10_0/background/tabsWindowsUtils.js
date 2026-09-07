//#include "asyncCallUtils.js"
//#include "tabsUtils.js"
//
//public:
//    function asyncGetTabWindowInfo(tabId, onlyIfSelected, callId)
//
//private:
//    function getWindowInfo(w)
//    function saveWindowInfo(w, callId)

//Sync with tabsWindowsUtils.js.h
cWindowInfoUndefined = "<undefined>";

function getWindowInfo(w)
{
    var result;
    if (w === undefined)
        result = cWindowInfoUndefined;
    else
        result = w.left + " " + w.top + " " + w.width + " " + w.height;
    return result;
}

function saveWindowInfo(w, callId)
{
    setCallResult(getWindowInfo(w), callId);
}

function asyncGetTabWindowInfo(tabId, onlyIfSelected, callId)
{
    chrome.tabs.get
    (
        tabId,
        function(tab)
        {
            if (tab === undefined)
                saveWindowInfo(undefined, callId);
            else
            {
                if (onlyIfSelected && !tab.selected)
                    saveWindowInfo(undefined, callId);
                else
                    safe_chrome_windows_get
                    (
                        tab.windowId,
                        function(w)
                        {
                            saveWindowInfo(w, callId);
                        }
                    );
            }
        }
    );
}