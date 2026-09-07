(() => {
  const IOCM_NAME = "$iocm12";
  function getIocm() { return window[IOCM_NAME]; };
  
  window.addEventListener("IOCM_REQUEST", (event) => {
      const { type, data } = event?.detail ?? {};

      if (type !== "TYPE_INVOKE" && type !== "TYPE_ANCESTOR") return;

      let result = {"retVal":0};
      const iocm = getIocm();

      if (iocm) {
        try {
          if (type === "TYPE_INVOKE") {
            result = iocm.invoke(data["request"]);
          } else {
            result = validateAncestorRequest(data["request"]["params"]);
          }
        } catch (e) {
          result = { error: String(e?.message ?? e) };
        }
      }

      let response = { responseId: data.requestId, "response": result };

      window.dispatchEvent(
        new CustomEvent("IOCM_RESPONSE", {
          detail: {
            type: "TYPE_CALLBACK",
            data: response
          }
        })
      );
    });

  function validateAncestorRequest(request) {
    const obj = getIocm().objectCache[request?.[0]?.objectId];

    const isContainer = obj !== null &&
                          (typeof obj === "object" || typeof obj === "function");

    if (!isContainer) {
      // console.error("Validated object is not container type:", obj);
      return getIocm().createRetVal(null, null, null);
    }

    return getIocm().createRetVal(obj.constructor?.name, null, null);
  }
})();