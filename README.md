# events-to-s3

This repo contains a Google Apps Script for publishing event data to Amazon S3. This repo is a based off [liddiard/google-sheet-s3](https://github.com/liddiard/google-sheet-s3) and the original README can be found [here](./FORKED-README.md).

## Setup an event file

**(1)** Copy [this template](https://docs.google.com/spreadsheets/d/1qQBXGPUiyxudkEmuQeX963oMXRrGqdHAh0moQFl_haE/edit?usp=sharing) and rename it.

__CSV Backup__

```
# Events tab
Event Title (US-EN),Event Title (ES-MX),Published,Date,Start Time,End Time,Timezone,Public Address,City,State,Zipcode,Latitude,Longitude
Bailey goes for a walk on the south lawn!!,Bailey va a pasear por el jardín sur.,TRUE,2020-01-04,8:00 AM,8:30 AM,EST,1600 Pennsylvania Ave NW,Washington,District of Columbia,20500,38.897678,-77.036611

# Fields tab
Field Name,English Value,Spanish Value,Field Key
Module Header,Events near you,Eventos cerca de ti,homepageHeader
RSVP Button,RSVP,RSVP,rsvpButtonCopy
Mile Marker Label,Miles,Millas,mileMarkerLabel
```

**(2)** Create a script in your new events sheet (Tools -> Script Editor). Paste the contents of `Code.gs` in this repo into the script editor. Within the script editor, create a new html file (File -> New -> HTML File) called `config.html` and copy the contents of the `config.html` in this repo.

**(3)** Save the script (cmd + s) and run it. Do this by going to the `select function` dropdown menu at the top and choosing the `createMenu` option. Then hit the run button to the left of the dropdown (It looks like a triangular "play" icon).

**(4)** Go back to your sheet, and you should see a new tab at the end called "Publish to S3". Select that and the menu 'configure' option. This will bring up a menu to configure S3 access. If you've already made the required AWS & S3 resources, skip to step 6.

**(5)** In the AWS console, create a new bucket and user specifically for this script.

To create the bucket, go to the S3 homepage and hit 'Create Bucket'. Make sure all of the policies restrict public access.

To create the user and permissions, go to the IAM homepage and create a new Policy.

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::ew-events/*"
        }
    ]
}
```

Replace `ew-events` with the name of your bucket.

Then add a new user with this policy attached, and set the 'AWS Access Type' to be 'Programmatic access'. Copy the access key & secret at the end of the user create flow.

**6**. Fill out the AWS properties in your event sheet within the configure menu we previously opened.

```
Bucket name: ${REPLACE_WITH_YOUR_BUCKET_NAME}
Path: (Leave blank)
AWS access key ID: ${REPLACE_WITH_YOUR_ACCESS_KEY}
AWS secret key: ${REPLACE_WITH_YOUR_SECRET_KEY}
```

If everything worked, all future changes in the sheet should result in an update being made to S3.
