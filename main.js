const puppeteer = require('puppeteer')
const fs = require('fs')
const { generateTree, isEmpty, deepCopy } = require('@xuanmo/utils')

;(async () => {
  let provinceData = []
  let cityOriginalData = []
  let countyOriginalData = []
  let townOriginalData = []
  const date = new Date()
  const sourceURL = `http://www.stats.gov.cn/sj/tjbz/tjyqhdmhcxhfdm/${date.getFullYear() - 1}/index.html`
  const browser = await puppeteer.launch({
    headless: 'new'
  })
  const page = await browser.newPage()

  page.setDefaultNavigationTimeout(120000)

  await page.goto(sourceURL)

  await page.setViewport({ width: 1440, height: 1024 })

  // 遍历出所有省份数据
  provinceData = await page.evaluate((provinceData) => {
    const provinceLinks = document.querySelector('.provincetable').querySelectorAll('a')
    for (let i = 0; i < provinceLinks.length; i++) {
      const province = provinceLinks[i]
      const url = province.href
      const { id } = url.match(/(?<id>\d+)\.html$/).groups
      const label = province.innerText.replace('\n', '')
      provinceData.push({
        label,
        value: `${id}0000000000`,
        url,
        parentId: '0'
      })
    }
    return provinceData
  }, provinceData)

  // 遍历城市数据
  for (let i = 0; i < provinceData.length; i++) {
    const item = provinceData[i]
    if (!item.url) continue
    await page.goto(item.url)
    console.log(item.label)
    cityOriginalData = await page.evaluate(([cityOriginalData, item]) => {
      document.querySelectorAll('.citytable .citytr').forEach((tr) => {
        const [codeEl, labelEl] = tr.querySelectorAll('td')
        const linkEl = labelEl.querySelector('a')
        cityOriginalData.push({
          label: labelEl?.innerText,
          value: codeEl?.innerText,
          parentId: item.value,
          url: linkEl ? linkEl.href : null
        })
      })
      return cityOriginalData
    }, [cityOriginalData, item])
  }

  // 遍历县级数据
  for (let i = 0; i < cityOriginalData.length; i++) {
    const item = cityOriginalData[i]
    if (!item.url) continue
    await page.goto(item.url)
    console.log(item.label)
    countyOriginalData = await page.evaluate(([countyOriginalData, item]) => {
      document.querySelectorAll('.countytable .countytr').forEach((tr) => {
        const [codeEl, labelEl] = tr.querySelectorAll('td')
        const linkEl = labelEl.querySelector('a')
        countyOriginalData.push({
          label: labelEl?.innerText,
          value: codeEl?.innerText,
          parentId: item.value,
          url: linkEl ? linkEl.href : null
        })
      })
      return countyOriginalData
    }, [countyOriginalData, item])
  }

  // 遍历镇级数据
  for (let i = 0; i < countyOriginalData.length; i++) {
    const item = countyOriginalData[i]
    if (!item.url) continue
    await page.goto(item.url)
    console.log(item.label)
    townOriginalData = await page.evaluate(([townOriginalData, item]) => {
      document.querySelectorAll('.towntable .towntr').forEach((tr) => {
        const [codeEl, labelEl] = tr.querySelectorAll('td')
        const linkEl = labelEl.querySelector('a')
        townOriginalData.push({
          label: labelEl?.innerText,
          value: codeEl?.innerText,
          parentId: item.value,
          url: linkEl ? linkEl.href : null
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
  ]

  // 省、市、县、镇
  const region = generateTree(deepCopy(flatData), '0', 'parentId', 'value')

  // 省、市
  const provinceCity = generateTree([...deepCopy(provinceData), ...deepCopy(cityOriginalData)], '0', 'parentId', 'value')

  // 省、市、县
  const provinceCityCounty = generateTree([...deepCopy(provinceData), ...deepCopy(cityOriginalData), ...deepCopy(countyOriginalData)], '0', 'parentId', 'value')

  // 清理多余的属性，减少数据体积
  const clear = (arr) => {
    return arr.map((item) => {
      delete item.parentId
      delete item.url
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
  fs.writeFileSync(
    'province.json',
    JSON.stringify(clear(provinceData), undefined, 2)
  )
  fs.writeFileSync(
    'province-city.json',
    JSON.stringify(clear(provinceCity), undefined, 2)
  )
  fs.writeFileSync(
    'province-city-county.json',
    JSON.stringify(clear(provinceCityCounty), undefined, 2)
  )
})()
