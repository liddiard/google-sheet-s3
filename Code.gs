// add a menu to the toolbar...
const createMenu = () => {
  const menu = SpreadsheetApp.getUi()
  .createMenu('Publish to S3')
  .addItem('Configure...', 'showConfig');

  if (hasRequiredProps()) {
    menu.addItem('Publish', 'publish');
  }

  menu.addToUi();
};

// ...when the add-on is installed or opened
const onOpen = () => {
  createMenu();
};

const onInstall = () => {
  createMenu();
};

// https://github.com/liddiard/google-sheet-s3/issues/3#issuecomment-1276788590
const s3PutObject = (objectName, object) => {
  const props = PropertiesService.getDocumentProperties().getProperties();
  const contentType = 'application/json';

  const contentBlob = Utilities.newBlob(JSON.stringify(object), contentType);
  contentBlob.setName(objectName);
  
  const service = 's3';
  const region = props.awsRegion;
  const action = 'PutObject';
  const params = {};
  const method = 'PUT';
  const payload = contentBlob.getDataAsString();
  const headers = {
    'Content-Type': contentType
  };
  const uri = `/${objectName}`;
  const options = {
    Bucket: props.bucketName
  };

  AWS.init(props.awsAccessKeyId, props.awsSecretKey);
  return AWS.request(service, region, action, params, method, payload, headers, uri, options);
};
  
// checks if document has the required configuration settings to publish to S3
// Note: does not check if the config is valid
const hasRequiredProps = () => {
  const props = PropertiesService.getDocumentProperties().getProperties();
  const requiredProps = [
    'bucketName',
    'awsRegion',
    'awsAccessKeyId',
    'awsSecretKey'
  ];
  return requiredProps.every(prop => props[prop]);
};

// publish updated JSON to S3 if changes were made to the first sheet
const publish = () => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getDocumentProperties().getProperties();
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

  // upload to AWS S3
  const response = s3PutObject([props.path, sheet.getId()].join('/'), cells);
  const error = response.toString(); // response is empty if publishing successful
  if (error) {
    throw error;
  }
};

// show the configuration modal dialog UI
const showConfig = () => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet(),
    props = PropertiesService.getDocumentProperties().getProperties(),
    // default to empty strings, otherwise the string "undefined" will be shown
    // for the value
    defaultProps = {
      bucketName: '',
      path: '',
      awsRegion: '',
      awsAccessKeyId: '',
      awsSecretKey: ''
    }
    template = HtmlService.createTemplateFromFile('config');
  
  template.sheetId = sheet.getId();
  Object.assign(template, defaultProps, props);
  SpreadsheetApp.getUi()
  .showModalDialog(template.evaluate(), 'Amazon S3 publishing configuration');
};

// update document configuration with values from the modal
const updateConfig = form => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const currentProps = PropertiesService.getDocumentProperties().getProperties();
  PropertiesService.getDocumentProperties().setProperties({
    ...currentProps,
    ...form
  });
  let title, message;
  if (hasRequiredProps()) {
    try {
      publish();
      title = '✓ Configuration updated';
      message = `Published spreadsheet will be accessible at:\nhttps://${form.bucketName}.s3.amazonaws.com/${form.path}/${sheet.getId()}`;
    }
    catch (error) {
      title = '⚠ Error publishing to S3';
      message = error;
    }
  }
  else {
    title = '⚠ Required info missing';
    message = 'You need to fill out all highlighted fields for your spreadsheet to be published to S3.';
  }
  createMenu(); // update menu to show the "Publish" item if needed
  const ui = SpreadsheetApp.getUi();
  ui.alert(title, message, ui.ButtonSet.OK);
};
