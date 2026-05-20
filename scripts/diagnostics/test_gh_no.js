const fs = require('fs');
fetch('https://boards-api.greenhouse.io/v1/boards/stripe/jobs')
  .then(res => res.json())
  .then(data => {
    fs.writeFileSync('gh_no_content.json', JSON.stringify(data.jobs[0], null, 2));
  });
