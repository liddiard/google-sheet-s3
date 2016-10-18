function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Publish to S3')
  .addItem('Configure...', 'showConfig')
  .addToUi();
}

// publish updated JSON to S3 if changes were made to the first sheet
function publish() {
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

  // create an array of objects keyed by header
  var objs = rows
  .slice(1)
  .map(function(row){
    var obj = {};
    row.forEach(function(value, index){
      // omit keys for cells whose values are empty strings
      if (typeof value !== 'string' || value.length) {
        var prop = rows[0][index];
        obj[prop] = value;
      }
    });
    return obj;
  });

  // upload to S3
  // https://engetc.com/projects/amazon-s3-api-binding-for-google-apps-script/
  var props = PropertiesService.getDocumentProperties().getProperties();
  var s3 = S3.getInstance(props.awsAccessKeyId, props.awsSecretKey);
  s3.putObject(props.bucketName, [props.path, sheet.getId()].join('/'), objs);
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
    awsSecretKey: form.awsSecretKey
  });
  var message;
  if (hasRequiredProps()) {
    message = 'Published spreadsheet will be accessible at \nhttps://' + form.bucketName + '.s3.amazonaws.com/' + form.path + '/' + sheet.getId();
    publish();
  }
  else {
    message = 'You will need to fill out all configuration options for your spreadsheet to be published to S3.';
  }
  var ui = SpreadsheetApp.getUi();
  ui.alert('✓ Configuration Updated', message, ui.ButtonSet.OK);
}

// checks if document has the required configuration settings to publish to S3
// does not check if the config is valid
function hasRequiredProps() {
  var props = PropertiesService.getDocumentProperties().getProperties();
  return (props.bucketName && props.bucketName.length && props.awsAccessKeyId &&
          props.awsAccessKeyId.length && props.awsSecretKey && props.awsSecretKey.length);
}
