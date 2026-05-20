const fs = require('fs');
fetch('https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true')
  .then(res => res.json())
  .then(data => {
    const firstTwo = data.jobs.slice(0, 2);
    const parsed = firstTwo.map(rawJob => {
      return {
        _raw: rawJob,
        extracted: {
          title: rawJob.title || rawJob.text,
          location: rawJob.location?.name || rawJob.categories?.location || 'Remote',
          url: rawJob.absolute_url || rawJob.hostedUrl,
          description_extracted: !!(rawJob.content || rawJob.descriptionPlain || rawJob.description)
        }
      };
    });
    fs.writeFileSync('gh_test.json', JSON.stringify(parsed, null, 2));
  });
