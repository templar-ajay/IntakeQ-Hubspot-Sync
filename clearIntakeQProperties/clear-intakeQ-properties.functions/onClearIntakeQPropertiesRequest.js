const axios = require("axios");

exports.main = async (context, sendResponse) => {
  const { PrivateAppKey, contactID } = context.body;
  console.log("privateAppKey", PrivateAppKey);
  console.log("contactID", contactID);

  // 1. get the list of all properties
  let data = "";

  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: "https://api.hubapi.com/crm/v3/properties/contacts?archived=false",
    headers: {
      Authorization: `Bearer ${PrivateAppKey}`,
    },
    data: data,
  };

  axios
    .request(config)
    .then((response) => {
      const properties = response.data.results;

      // 2. filter out the intakeQ properties
      const intakeQProperties = properties.filter((x) =>
        x.name.includes("intakeq_")
      );

      // 3. make a payload and request the hubspot API to empty the properties.
      const payload = {
        properties: {},
      };

      intakeQProperties.forEach((property) => {
        payload.properties[property.name] = "";
      });
      console.log("payload", payload);

      let data = JSON.stringify(payload);

      let config = {
        method: "patch",
        maxBodyLength: Infinity,
        url: "https://api.hubapi.com/crm/v3/objects/contacts/" + contactID,
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${PrivateAppKey}`,
        },
        data: data,
      };

      axios
        .request(config)
        .then((response) => {
          console.log(JSON.stringify(response.data));
          sendResponse({ body: { success: "true" }, statusCode: 200 });
        })
        .catch((error) => {
          console.log(error);
          sendResponse({
            body: {
              success: "false",
              response: "error updating contact property",
              error: error,
            },
            statusCode: 400,
          });
        });
    })
    .catch((error) => {
      console.log(error);
      sendResponse({
        body: {
          success: "false",
          response: "error fetching all properties",
          error: error,
        },
        statusCode: 400,
      });
    });

  // sendResponse is a callback function you call to send your response.
};
