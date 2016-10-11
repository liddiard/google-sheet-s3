# google-sheet-s3

[Google Apps Script](https://developers.google.com/apps-script/) to upload a Google Sheet to an Amazon S3 bucket as JSON with objects keyed by header name. Auto-republish on edit. Correctly maintain number and boolean data types.

## Why?

Use case: Displaying simple, structured, spreadsheet-like, publicly accessible data on a website (possibly with thousands of simultaneous visitors) that is easily updatable (possibly by multiple people at once) without the overhead and development time of writing, deploying, and maintaining a full-blown web application. 

Examples: staff directory list, restaurant menu items listing, sports team standings page, live blog. 

## Why not [alternative]?

- Doesn't require OAuth like the [official Google Sheets API](https://developers.google.com/sheets/guides/authorizing) (no good for anonymous data viewing).
- Not using [deprecated APIs](https://developers.google.com/gdata/samples/spreadsheet_sample) like [Tabletop.js](https://github.com/jsoma/tabletop) that could suffer an untimely disappearance at the whims of Google.
- Doesn't require an intermediary web application like [WSJ uses (used?)](https://gist.github.com/jsvine/3295633).
- Not an alternative service like [Airtable](https://airtable.com) or [Fieldbook](https://fieldbook.com) that is cool but costs 💰💰💰.
- Not slow at returning data like [Google Apps Script Web Apps](http://pipetree.com/qmacro/blog/2013/10/sheetasjson-google-spreadsheet-data-as-json/
) seem to be. (If you're okay with 2000ms response times, this solution is easier because it doesn't involve S3. S3 response times tend to be 10-20x faster.) 

## Setup

### Prerequisites

- An Amazon S3 bucket for which you have [created security credentials](https://console.aws.amazon.com/iam/home?nc2=h_m_sc#users) that have read and write permissions on the bucket.

### Instructions

1. Create or open an existing Google Sheet.
2. Format the sheet so that the first row contains the column headers you want your JSON objects to have as properties. Example: ![Example](http://i.imgur.com/kTd3noR.png)
3. Enable the add-on for this sheet.
4. In the newly appeared "Publish to S3" menu, click "Configure..."
5. Fill in the S3 bucket name, path within the bucket (leave blank if none), and AWS credentials that allow write access to the bucket.
6. Click "Save". The S3 URL of your JSON-ified spreadsheet will be shown. Replace [region name] with the name of the region your bucket is in. It should be something like "us-west-2".

That's it! Any time you make a change to the spreadsheet, the changes will be re-published to the JSON file. The JSON file's filename is taken from the spreadsheet ID, so the spreadsheet can be renamed without breaking anything.

## Usage notes

- The add-on only looks at the sequentially first sheet tab (called "Sheet1" by default). It won't publish or respond to changes on other tabs.
- The add-on will ignore columns that don't have a value in the header (row 1) of the spreadsheet.
- The add-on will ignore empty rows, skipping over them to the next row with values.
- A missing value in a row is represented in the JSON as the absence of the corresponding key for that object. So, if you have a column that could have missing or optional values, be sure to check for the presence/absence of that property in any code that works with the JSON. (e.g. use `.hasOwnProperty(columnHeaderName)` in JavaScript)