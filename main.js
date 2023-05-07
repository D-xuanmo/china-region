const puppeteer = require('puppeteer')
const fs = require('fs')
const { generateTree } = require('@xuanmo/javascript-utils')

const sleep = (wait) => new Promise((resolve) => {
  setTimeout(resolve, wait)
});

(async () => {
  let provinceData = []
  let cityOriginalData = []
  let countyOriginalData = []
  let townOriginalData = []
  const sourceURL = 'http://www.stats.gov.cn/sj/tjbz/tjyqhdmhcxhfdm/2022/index.html'
  const browser = await puppeteer.launch({
    headless: 'new'
  })
  const page = await browser.newPage()

  await page.goto(sourceURL)

  await page.setViewport({ width: 1440, height: 1024 })

  // 遍历出所有省份数据
  provinceData = await page.evaluate((provinceData) => {
    const provinceLinks = document.querySelector('.provincetable').querySelectorAll('a')
    for (let i = 0; i < provinceLinks.length; i++) {
      const province = provinceLinks[i]
      const url = province.href
      const { id } = url.match(/(?<id>\d+)\.html$/).groups
      provinceData.push({
        label: province.innerText.replace('\n', ''),
        value: `${id}0000000`,
        url,
        parentId: '0'
      })
    }
    return provinceData
  }, provinceData)

  // 遍历城市数据
  for (let i = 0; i < provinceData.length; i++) {
    const item = provinceData[i]
    await sleep(5000)
    await page.goto(item.url)
    cityOriginalData = await page.evaluate(([cityOriginalData, item]) => {
      const cityLinks = document.querySelectorAll('.citytable .citytr td:last-of-type a')
      cityLinks.forEach((city) => {
        const url = city.href
        const { id } = url.match(/(?<id>\d+)\.html$/).groups
        cityOriginalData.push({
          label: city.innerText.replace('\n', ''),
          value: `${id}00000`,
          url,
          parentId: item.value
        })
      })
      return cityOriginalData
    }, [cityOriginalData, item])
  }

  // 遍历县级数据
  for (let i = 0; i < cityOriginalData.length; i++) {
    await sleep(5000)
    const item = cityOriginalData[i]
    await page.goto(item.url)
    countyOriginalData = await page.evaluate(([countyOriginalData, item]) => {
      const countyLinks = document.querySelectorAll('.countytable .countytr td:last-of-type a')
      countyLinks.forEach((county) => {
        const url = county.href
        const { id } = url.match(/(?<id>\d+)\.html$/).groups
        countyOriginalData.push({
          label: county.innerText.replace('\n', ''),
          value: `${id}000`,
          url,
          parentId: item.value
        })
      })
      return countyOriginalData
    }, [countyOriginalData, item])
  }

  // 遍历镇级数据
  for (let i = 0; i < countyOriginalData.length; i++) {
    await sleep(5000)
    const item = countyOriginalData[i]
    await page.goto(item.url)
    townOriginalData = await page.evaluate(([townOriginalData, item]) => {
      const countyLinks = document.querySelectorAll('.towntable .towntr td:last-of-type a')
      countyLinks.forEach((county) => {
        const url = county.href
        const { id } = url.match(/(?<id>\d+)\.html$/).groups
        townOriginalData.push({
          label: county.innerText.replace('\n', ''),
          value: id,
          url,
          parentId: item.value
        })
      })
      return townOriginalData
    }, [townOriginalData, item])
  }

  await browser.close()

  const flatData = [
    ...provinceData,
    ...cityOriginalData,
    ...countyOriginalData,
    ...townOriginalData
  ].map((item) => {
    const { url, ...rest } = item
    return rest
  })
  fs.writeFileSync(
    'region.json',
    JSON.stringify(
      generateTree(flatData, '0', 'parentId', 'value'),
      undefined,
      2
    )
  )
})()
