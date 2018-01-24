function createMenu() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Publish to S3')
  .addItem('Configure...', 'showConfig')
  .addToUi();
}

function onInstall() { 
  createMenu();
}

function onOpen() { 
  createMenu();
}

// publish updated JSON to S3 if changes were made to the first sheet
// event object passed if called from trigger
// BE: Optional parameter file_type can be passed to export as csv instead.
function publish(event, file_type) {
  file_type = file_type || PropertiesService.getDocumentProperties().getProperties().file_format;
  file_type = file_type || "json";
  // do nothing if required configuration settings are not present
  if (!hasRequiredProps()) {
    return;
  }

  // do nothing if the edited sheet is not the first one
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  // sheets are indexed from 1 instead of 0
  if (sheet.getActiveSheet().getIndex() > 1) {
    return;
  }

  // get cell values from the range that contains data (2D array)
  var rows = sheet
  .getDataRange()
  .getValues();

  // filter out empty rows
  rows = rows.filter(function(row){
    return row
    .some(function(value){
      return typeof value !== 'string' || value.length;
    });
  })
  // filter out columns that don't have a header (i.e. text in row 1)
  .map(function(row){
    return row
    .filter(function(value, index){
      return rows[0][index].length;
    });
  });

  if (file_type == "csv") {
    var csv = "";
      // var rs = sheet.getDataRange().getValues();
      rows.forEach(function(e) {
        csv += e.join(",") + "\n";
      });
      var objs = Utilities.newBlob(csv);
  } else if (file_type == "json") {
    // create an array of objects keyed by header
    var objs = rows
    .slice(1)
    .map(function(row){
      var obj = {};
      row.forEach(function(value, index){
        var prop = rows[0][index];
        // represent blank cell values as `null`
        // blank cells always appear as an empty string regardless of the data
        // type of other values in the column. neutralizing everything to `null`
        // lets us avoid mixing empty strings with other data types for a prop.
        obj[prop] = (typeof value === 'string' && !value.length) ? null : value;
      });
      return obj;
    });    
  }

  
  // upload to S3
  // https://engetc.com/projects/amazon-s3-api-binding-for-google-apps-script/
  var props = PropertiesService.getDocumentProperties().getProperties();
 //  var s3 = S3.getInstance(props.awsAccessKeyId, props.awsSecretKey); // S3 class doesn't have a getInstance(), that's on the S3.gs code file.
  var s3 = getInstance(props.awsAccessKeyId, props.awsSecretKey);

  s3.putObject(props.bucketName, [props.path, sheet.getId() + "." + file_type].join('/'), objs);
}

// show the configuration modal dialog UI
function showConfig() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getDocumentProperties().getProperties();
  var template = HtmlService.createTemplateFromFile('config');
  template.sheetId = sheet.getId();
  template.bucketName = props.bucketName || '';
  template.path = props.path || '';
  template.awsAccessKeyId = props.awsAccessKeyId || '';
  template.awsSecretKey = props.awsSecretKey || '';
  ui.showModalDialog(template.evaluate(), 'Amazon S3 publish configuration');
}

// update document configuration with values from form UI
function updateConfig(form) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getDocumentProperties().setProperties({
    bucketName: form.bucketName,
    path: form.path,
    awsAccessKeyId: form.awsAccessKeyId,
    awsSecretKey: form.awsSecretKey,
    file_format: form.file_format
  });
  var message;
  if (hasRequiredProps()) {
    message = 'Published spreadsheet will be accessible at: \nhttps://' + form.bucketName + '.s3.amazonaws.com/' + form.path + '/' + sheet.getId() + "." + form.file_format.toLowerCase();
    publish();
    // Create an onChange trigger programatically instead of manually because 
    // manual triggers disappear for no reason. See:
    // https://code.google.com/p/google-apps-script-issues/issues/detail?id=4854
    // https://code.google.com/p/google-apps-script-issues/issues/detail?id=5831
    var sheet = SpreadsheetApp.getActive();
    ScriptApp.newTrigger("publish")
             .forSpreadsheet(sheet)
             .onChange()
             .create();
  }
  else {
    message = 'You will need to fill out all configuration options for your spreadsheet to be published to S3.';
  }
  var ui = SpreadsheetApp.getUi();
  ui.alert('✓ Configuration updated', message, ui.ButtonSet.OK);
}

// checks if document has the required configuration settings to publish to S3
// does not check if the config is valid
function hasRequiredProps() {
  var props = PropertiesService.getDocumentProperties().getProperties();
  return props.bucketName && props.awsAccessKeyId && props.awsSecretKey && props.file_format;
}