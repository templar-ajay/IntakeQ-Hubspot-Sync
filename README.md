# IntakeQ-Hubspot-Sync
This serverless function is hosted in hubspot and syncs the answers of IntakeQ form questions to the Contact properties in Hubspot

onFormSubmission contains the functionality to take all the answers from the IntakeQ form and check if a property with the same name as that of the intakeQ question is present in hubspot. if yes it will find or create the contact with the email in the intakeQ form and update the value of those properties of the contact.

clearIntakeQProperties contains the functionality to clear the values of the properties which were populated from IntakeQ 
