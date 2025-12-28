const obj = require('./data.json')
const data = obj.data
const bodyParts = obj.bodyParts
const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const download = require('image-downloader')



function downloadImage(url, name) {
    const imageName = name.trim().replace(/ /g, '_').toLowerCase()
    const options = {
        url: url,
        dest: path.join(__dirname, `./images/${imageName}.jpg`)
    }

    if (fs.existsSync(options.dest)) {
        return Promise.resolve(`${imageName}.jpg`)
    }

    return download.image(options)
        .then(({ filename }) => {
            // console.log('Saved to', filename)  // saved to /path/to/dest/image.jpg
            return `${imageName}.jpg`

        })
        .catch((err) => console.error(err))
}

// console.log({ data });
// const output 
const output = {}
function randomNumber() {
    return Math.floor(Math.random() * 100000)
}
async function start() {
    // const fileName = await downloadImage(data[0].image_name, data[0].name)

    for (let i = 0; i < data.length; i++) {
        try {
            console.log(`${i + 1} / ${data.length}`);
            const id = randomNumber()
            const item = data[i];
            const url = item.image_name;
            const fileName = await downloadImage(item.image_name, item.name)
            output[id] = {
                id,
                name: item.name.trim(),
                image: fileName,
                bodyPart: item.body_part_id ? JSON.parse(item.body_part_id).map(id => bodyParts[id]) : []
            }
        } catch (error) {
            console.log('error: ' + i);
            console.error(error);
        }
        fs.writeFileSync(path.join(__dirname, './output.json'), JSON.stringify(output, null, 2))
    }
}
async function fix() {
    const files = fs.readdirSync(path.join(__dirname, './images'))
    for (const file of files) {
        if (file.endsWith(".jpg.jpg")) {
            const newFileName = file.replace('.jpg.jpg', '.jpg')
            fs.renameSync(path.join(__dirname, `./images/${file}`), path.join(__dirname, `./images/${newFileName}`))

        }
    }
}
start()

/*
[Error: ENOENT: no such file or directory, open '/Users/gil/Projects/training-plan/scripts/exercises/images/3/4_sit-up.jpg'] {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/Users/gil/Projects/training-plan/scripts/exercises/images/3/4_sit-up.jpg'
}
*/