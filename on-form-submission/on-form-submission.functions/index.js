const axios = require("axios");

const allowed_properties = ["firstname", "lastname", "email"];

const { HUBSPOT_PRIVATE_APP_TOKEN, INTAKEQ_API_KEY } = process.env;

function formatPropertyId(inputString, prefix = "intakeq_") {
  // Remove the non A-Z, a-z, 0-9 character at the beginning of the input string
  let cleanedInput = (prefix + inputString)
    .trim()
    .replace(/^[^a-zA-Z0-9]+/, "");

  // Use regular expression to replace characters not in the range A-Z, a-z, or 0-9 with underscores
  let resultString = cleanedInput
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase()
    .slice(0, 99);

  // Check if the result string starts with a digit (natural number)
  if (/^[0-9]/.test(resultString)) {
    resultString = "n" + resultString; // Add "n" to the beginning
  }

  return resultString;
}

function filterProperties(properties) {
  return properties.filter((x) => {
    if (!x) {
      // filter out empty entries
      return false;
    } else {
      // filter out properties not included in allowed_properties list.
      return allowed_properties.includes(x.propertyId);
    }
  });
}

exports.main = async (context, sendResponse) => {
  let functionResponse,
    statusCode = 200,
    fullFormData;

  // your code called when the function is executed
  functionResponse = "Serverless Function working...";

  // update the allowed_properties array with the hubspot data
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: "https://api.hubapi.com/crm/v3/properties/contact?archived=false",
    headers: {
      Authorization: `Bearer ${HUBSPOT_PRIVATE_APP_TOKEN}`,
    },
  };

  axios
    .request(config)
    .then((response) => {
      // console.log(JSON.stringify(response.data));
      response.data.results
        .map((x) => x.name)
        .forEach((x) => allowed_properties.push(x));
    })
    .catch((error) => {
      console.log(error);
    })
    .finally(() => {
      // get the intake ID
      const { IntakeId } = context?.body;

      console.log("The intake ID is", IntakeId);

      if (!IntakeId) {
        statusCode = 400; // bad request
      } else {
        // use the intake id to get the full form details

        const apiUrl = `https://intakeq.com/api/v1/intakes/${IntakeId}`;

        const config = {
          headers: {
            "X-Auth-Key": INTAKEQ_API_KEY,
          },
        };

        axios
          .get(apiUrl, config)
          .then(({ data }) => {
            fullFormData = data;
          })
          .catch((error) => {
            // console.error("Error:", error);
            console.log("error retrieving full form data");
          })
          .finally(() => {
            // check if a contact with the same email address exists in hubspot CRM

            const { ClientEmail, ClientName, Questions } = fullFormData;

            const properties = filterProperties(
              Questions.map(({ Text, Answer }) => {
                if (Answer != "null" && Answer != null) {
                  return {
                    propertyId: formatPropertyId(Text),
                    propertyValue: Answer,
                  };
                }
              }).filter((x) => x)
            );

            if (ClientEmail) {
              // if the email exists search hubspot for the id of contact
              let IDofFoundContact;

              let data = JSON.stringify({
                filterGroups: [
                  {
                    filters: [
                      {
                        operator: "CONTAINS_TOKEN",
                        propertyName: "email",
                        value: String(ClientEmail),
                      },
                    ],
                  },
                ],
                properties: ["email"],
              });

              let config = {
                method: "post",
                maxBodyLength: Infinity,
                url: "https://api.hubapi.com/crm/v3/objects/contacts/search",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${HUBSPOT_PRIVATE_APP_TOKEN}`,
                },
                data: data,
              };

              axios
                .request(config)
                .then((response) => {
                  IDofFoundContact = response?.data?.results[0]?.id;
                })
                .catch((error) => {
                  // console.log(error);
                  console.log(
                    "Error occurred while searching for the contact associated with the Email-Address."
                  );
                })
                .finally(() => {
                  if (IDofFoundContact) {
                    // if there is an id of found contact make a patch request.

                    const payload = {
                      properties: {
                        email: ClientEmail,
                        lastname: ClientName.split(" ")[1],
                        firstname: ClientName.split(" ")[0],
                      },
                    };
                    // add email to  intakeq_email for zapier to find the contact
                    if (allowed_properties.includes("intakeq_email")) {
                      payload.properties.intakeq_email = ClientEmail;
                    }
                    //
                    properties.forEach(({ propertyId, propertyValue }) => {
                      payload.properties[propertyId] = propertyValue;
                    });

                    let data = JSON.stringify(payload);

                    console.log("payload", payload);

                    let config = {
                      method: "patch",
                      maxBodyLength: Infinity,
                      url: `https://api.hubapi.com/crm/v3/objects/contacts/${IDofFoundContact}`,
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${HUBSPOT_PRIVATE_APP_TOKEN}`,
                      },
                      data: data,
                    };

                    axios
                      .request(config)
                      .then((response) => {
                        // console.log(JSON.stringify(response.data));
                        console.log("contact updated");
                      })
                      .catch((error) => {
                        // console.log(error);
                        console.log("error occurred while updating contact");
                      });
                  } else {
                    // else make a post request to create a new contact.
                    const payload = {
                      properties: {
                        email: ClientEmail,
                        lastname: ClientName.split(" ")[1],
                        firstname: ClientName.split(" ")[0],
                      },
                    };

                    // add email to  intakeq_email for zapier to find the contact
                    if (allowed_properties.includes("intakeq_email")) {
                      payload.properties.intakeq_email = ClientEmail;
                    }

                    properties.forEach(({ propertyId, propertyValue }) => {
                      payload.properties[propertyId] = propertyValue;
                    });

                    let data = JSON.stringify(payload);

                    console.log("payload", payload);

                    let config = {
                      method: "post",
                      maxBodyLength: Infinity,
                      url: "https://api.hubapi.com/crm/v3/objects/contacts",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${HUBSPOT_PRIVATE_APP_TOKEN}`,
                      },
                      data: data,
                    };

                    axios
                      .request(config)
                      .then((response) => {
                        // console.log(JSON.stringify(response.data));
                        console.log("new contact created");
                      })
                      .catch((error) => {
                        // console.log(error);
                        console.log("error occurred while creating contact");
                      });
                  }
                });
            } else {
              functionResponse =
                "client email address is required to create a contact in hubspot.";
              statusCode = 400;
            }
          });
      }
    });

  // sendResponse is a callback function you call to send your response.
  sendResponse({ body: functionResponse, statusCode: statusCode });
};
