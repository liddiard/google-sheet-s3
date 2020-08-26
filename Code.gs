// add a menu to the toolbar when the add-on is installed or opened
const createMenu = () => {
  SpreadsheetApp.getUi()
  .createMenu('Publish to S3')
  .addItem('Configure...', 'showConfig')
  .addToUi();
}
const onInstall = createMenu;
const onOpen = createMenu;
  
// checks if document has the required configuration settings to publish to S3
// Note: does not check if the config is valid
const hasRequiredProps = () => {
  const props = PropertiesService.getDocumentProperties().getProperties();
  const { bucketName, awsAccessKeyId, awsSecretKey } = props
  return (bucketName && bucketName.length &&
          awsAccessKeyId && awsAccessKeyId.length &&
          awsSecretKey && awsSecretKey.length
  );
}

// publish updated JSON to S3 if changes were made to the first sheet
const publish = () => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  // do nothing if required configuration settings are not present, or
  // if the edited sheet is not the first one (sheets are indexed from 1,
  // not 0)
  if (!hasRequiredProps() || sheet.getActiveSheet().getIndex() > 1) {
    return;
  }

  // get cell values from the range that contains data (2D array)
  const rows = sheet
  .getDataRange()
  .getValues()
  // filter out empty rows
  .filter(row =>
    row.some(val => typeof val !== 'string' || val.length)
  )
  // filter out columns that don't have a header (i.e. text in row 1)
  .map((row, _, rows) =>
    row.filter((_, index) => rows[0][index].length)
  );

  // create an array of cell objects keyed by header
  const cells = rows
  // exclude the header row
  .slice(1)
  .map(row =>
    row.reduce((acc, val, index) =>
      // represent blank cell values as `null`
      // blank cells always appear as an empty string regardless of the data
      // type of other values in the column. neutralizing everything to `null`
      // lets us avoid mixing empty strings with other data types within a column.
      Object.assign(
        acc,
        { [rows[0][index]]: (typeof val === 'string' && !val.length) ? null : val }
      )
    , {})
  );

  // upload to S3
  // https://engetc.com/projects/amazon-s3-api-binding-for-google-apps-script/
  const props = PropertiesService.getDocumentProperties().getProperties();
  const s3 = S3.getInstance(props.awsAccessKeyId, props.awsSecretKey);
  s3.putObject(props.bucketName, [props.path, sheet.getId()].join('/'), cells);
}

// show the configuration modal dialog UI
const showConfig = () => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet(),
    props = PropertiesService.getDocumentProperties().getProperties(),
    template = HtmlService.createTemplateFromFile('config');
  template.sheetId = sheet.getId();
  // default to empty strings, otherwise the string "undefined" will be shown
  // for the value
  const templateProps = Object.entries(props)
  .reduce((acc, [key, val]) => Object.assign(acc, { [key]: val || '' }), {})
  Object.assign(template, templateProps)
  SpreadsheetApp.getUi()
  .showModalDialog(template.evaluate(), 'Amazon S3 publish configuration');
}

// update document configuration with values from the modal
const updateConfig = form => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getDocumentProperties().setProperties({
    bucketName: form.bucketName,
    path: form.path,
    awsAccessKeyId: form.awsAccessKeyId,
    awsSecretKey: form.awsSecretKey
  });
  let title, message;
  if (hasRequiredProps()) {
    try {
      publish();
      title = '✓ Configuration updated';
      message = `Published spreadsheet will be accessible at: \nhttps://${form.bucketName}.s3.amazonaws.com/${form.path}/${sheet.getId()}`;
    }
    catch (ex) {
      title = '⚠ Error publishing to S3'
      message = `Sorry, there was an error publishing your spreadsheet:\n${ex}`
    }
    // If the publish trigger doesn't already exist, create it programatically instead
    // of manually because manual triggers disappear for no reason. See:
    // https://code.google.com/p/google-apps-script-issues/issues/detail?id=4854
    // https://code.google.com/p/google-apps-script-issues/issues/detail?id=5831
    if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'publish')) {
      ScriptApp.newTrigger('publish')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onChange()
      .create();
    }
  }
  else {
    title = '⚠ Required info missing';
    message = 'You need to fill out all fields for your spreadsheet to be published to S3.';
  }
  const ui = SpreadsheetApp.getUi();
  ui.alert(title, message, ui.ButtonSet.OK);
}
