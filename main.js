const puppeteer = require('puppeteer')
const fs = require('fs')
const { generateTree, isEmpty } = require('@xuanmo/javascript-utils')

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
      if (i > 3) break
      const province = provinceLinks[i]
      const url = province.href
      const { id } = url.match(/(?<id>\d+)\.html$/).groups
      const label = province.innerText.replace('\n', '')
      provinceData.push({
        label,
        value: `${id}0000000`,
        url,
        parentId: '0'
      })
    }
    return provinceData
  }, provinceData)

  // 遍历城市数据
  for (let i = 0; i < provinceData.length; i++) {
    if (i > 3) break
    const item = provinceData[i]
    // await sleep(2000)
    await page.goto(item.url)
    console.log(item.label)
    cityOriginalData = await page.evaluate(([cityOriginalData, item]) => {
      const cityLinks = document.querySelectorAll('.citytable .citytr td:last-of-type a')
      cityLinks.forEach((city) => {
        const url = city.href
        const { id } = url.match(/(?<id>\d+)\.html$/).groups
        const label = city.innerText.replace('\n', '')
        cityOriginalData.push({
          label,
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
    if (i > 3) break
    const item = cityOriginalData[i]
    // await sleep(2000)
    await page.goto(item.url)
    console.log(item.label)
    countyOriginalData = await page.evaluate(([countyOriginalData, item]) => {
      const countyLinks = document.querySelectorAll('.countytable .countytr td:last-of-type a')
      countyLinks.forEach((county) => {
        const url = county.href
        const { id } = url.match(/(?<id>\d+)\.html$/).groups
        const label = county.innerText.replace('\n', '')
        countyOriginalData.push({
          label,
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
    if (i > 3) break
    const item = countyOriginalData[i]
    // await sleep(2000)
    await page.goto(item.url)
    console.log(item.label)
    townOriginalData = await page.evaluate(([townOriginalData, item]) => {
      const countyLinks = document.querySelectorAll('.towntable .towntr td:last-of-type a')
      countyLinks.forEach((county) => {
        const url = county.href
        const { id } = url.match(/(?<id>\d+)\.html$/).groups
        const label = county.innerText.replace('\n', '')
        townOriginalData.push({
          label,
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
  const region = generateTree(flatData, '0', 'parentId', 'value')

  // 清理多余的属性，减少数据体积
  const clear = (arr) => {
    return arr.map((item) => {
      delete item.parentId
      if (isEmpty(item.children)) delete item.children
      if (Array.isArray(item.children)) {
        item.children = clear(item.children)
      }
      return item
    })
  }

  fs.writeFileSync(
    'region.json',
    JSON.stringify(clear(region), undefined, 2)
  )
})()
