import { sendSuccess } from '../../utils/respond.js'
import { validatedQuery } from '../../middlewares/validate.js'
import {
  listBrandsPublic,
  listCategoriesPublic,
  getCategoryTree,
  getProductBySlugPublic,
  listProductsPublic,
  getFeaturedProducts,
  getRelatedProducts,
  searchSuggestions,
  getCategoryBySlugPublic
} from './catalog.service.js'

export async function listBrandsHandler(_req, res, next) {
  try {
    const data = await listBrandsPublic()
    return sendSuccess(res, { message: 'Brands fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function listCategoriesHandler(_req, res, next) {
  try {
    const data = await listCategoriesPublic()
    return sendSuccess(res, { message: 'Categories fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function categoryTreeHandler(_req, res, next) {
  try {
    const data = await getCategoryTree(true)
    return sendSuccess(res, { message: 'Category tree fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function listProductsHandler(req, res, next) {
  try {
    const data = await listProductsPublic(validatedQuery(req))
    return sendSuccess(res, { message: 'Products fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function featuredProductsHandler(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 8, 24)
    const data = await getFeaturedProducts(limit)
    return sendSuccess(res, { message: 'Featured products fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function relatedProductsHandler(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 8, 16)
    const data = await getRelatedProducts(req.params.slug, limit)
    return sendSuccess(res, { message: 'Related products fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function getProductHandler(req, res, next) {
  try {
    const data = await getProductBySlugPublic(req.params.slug)
    return sendSuccess(res, { message: 'Product fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function categoryBySlugHandler(req, res, next) {
  try {
    const data = await getCategoryBySlugPublic(req.params.slug)
    return sendSuccess(res, { message: 'Category fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function suggestionsHandler(req, res, next) {
  try {
    const data = await searchSuggestions(req.query.q)
    return sendSuccess(res, { message: 'Suggestions fetched', data })
  } catch (err) {
    next(err)
  }
}
