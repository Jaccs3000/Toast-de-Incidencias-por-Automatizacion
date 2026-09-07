//public:
//    function popCallResult(callId)
//    function denyCallResult(callId)
//
//internal:
//    function setCallResult(value, callId)
//
//private:
//    var gCallResults
//    var gDeniedCallResults

var gCallResults = {};
var gDeniedCallResults = {};

function setCallResult(value, callId)
{
    if (gDeniedCallResults[callId] !== undefined)
        delete gDeniedCallResults[callId];
    else
        gCallResults[callId] = value;
}

function popCallResult(callId)
{
    var result = gCallResults[callId];
    if (result !== undefined)
        delete gCallResults[callId];
    return result;
}

function denyCallResult(callId)
{
    if (getResult(callId) === undefined)
        gDeniedCallResults[callId] = {};
}