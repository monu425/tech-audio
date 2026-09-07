import * as adminService from './admin.service.js'
import * as adminCatalogService from './admin.catalog.service.js'
import { validatedQuery } from '../../middlewares/validate.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

function actor(req) {
  return { _id: req.user._id, name: req.user.name }
}

function pageable(req) {
  const query = validatedQuery(req)
  return { ...query, page: query.page ?? 1, pageSize: query.pageSize ?? 20 }
}

export const getMe = async (req, res) => ok(res, await adminService.getAdminMe(req.user))
export const getDashboard = async (req, res) => ok(res, await adminService.getDashboardData())
export const getRoles = async (req, res) => ok(res, adminService.getRolesInfo())
export const getSettings = async (req, res) => ok(res, await adminService.getSettingsView())
export const updateSettings = async (req, res) =>
  ok(res, await adminService.updateSettings(req.body))

export const listProducts = async (req, res) =>
  ok(res, await adminCatalogService.listProductsAdmin(pageable(req)))

export const createProduct = async (req, res) =>
  ok(res, await adminCatalogService.createProductAdmin(req.body), 201)

export const getProductFormMeta = async (req, res) =>
  ok(res, await adminCatalogService.getProductFormMeta())

export const getProduct = async (req, res) =>
  ok(res, await adminCatalogService.getProductAdmin(req.params.id))

export const updateProduct = async (req, res) =>
  ok(res, await adminCatalogService.updateProductAdmin(req.params.id, req.body))

export const archiveProduct = async (req, res) =>
  ok(res, await adminCatalogService.archiveProductAdmin(req.params.id, actor(req)))

export const getProductInventory = async (req, res) =>
  ok(res, await adminCatalogService.getProductInventory(req.params.id))

export const adjustProductInventory = async (req, res) =>
  ok(res, await adminCatalogService.adjustProductStock(req.params.id, req.body, actor(req)))

export const listBrands = async (req, res) => ok(res, await adminCatalogService.listBrandsAdmin())
export const createBrand = async (req, res) =>
  ok(res, await adminCatalogService.createBrandAdmin(req.body), 201)
export const updateBrand = async (req, res) =>
  ok(res, await adminCatalogService.updateBrandAdmin(req.params.id, req.body))
export const archiveBrand = async (req, res) =>
  ok(res, await adminCatalogService.archiveBrandAdmin(req.params.id))

export const listCategories = async (req, res) =>
  ok(res, await adminCatalogService.listCategoriesAdmin())
export const createCategory = async (req, res) =>
  ok(res, await adminCatalogService.createCategoryAdmin(req.body), 201)
export const updateCategory = async (req, res) =>
  ok(res, await adminCatalogService.updateCategoryAdmin(req.params.id, req.body))
export const archiveCategory = async (req, res) =>
  ok(res, await adminCatalogService.archiveCategoryAdmin(req.params.id))

export const listOrders = async (req, res) => ok(res, await adminService.listOrders(pageable(req)))
export const getOrder = async (req, res) =>
  ok(res, await adminService.getOrderDetail(req.params.id))
export const transitionOrder = async (req, res) =>
  ok(res, await adminService.transitionOrder(req.params.id, req.body, actor(req)))
export const setPaymentStatus = async (req, res) =>
  ok(res, await adminService.setOrderPaymentStatus(req.params.id, req.body, actor(req)))

export const listCustomers = async (req, res) =>
  ok(res, await adminService.listCustomers(pageable(req)))
export const getCustomer = async (req, res) =>
  ok(res, await adminService.getCustomerDetail(req.params.id))
export const updateCustomerStatus = async (req, res) =>
  ok(res, await adminService.updateCustomerStatus(req.params.id, req.body, actor(req)))

export const listStaff = async (req, res) => ok(res, await adminService.listStaff(pageable(req)))
export const createStaff = async (req, res) =>
  ok(res, await adminService.createStaffMember(req.body, actor(req)), 201)
export const updateStaffStatus = async (req, res) =>
  ok(res, await adminService.updateStaffStatus(req.params.id, req.body, actor(req)))
export const changeStaffRole = async (req, res) =>
  ok(res, await adminService.changeUserRole(req.params.id, req.body, actor(req)))

export const listCoupons = async (req, res) =>
  ok(res, await adminCatalogService.listCouponsAdmin(pageable(req)))
export const getCoupon = async (req, res) =>
  ok(res, await adminCatalogService.getCouponAdmin(req.params.id))
export const createCoupon = async (req, res) =>
  ok(res, await adminCatalogService.createCouponAdmin(req.body), 201)
export const updateCoupon = async (req, res) =>
  ok(res, await adminCatalogService.updateCouponAdmin(req.params.id, req.body))
export const toggleCoupon = async (req, res) =>
  ok(res, await adminCatalogService.toggleCouponAdmin(req.params.id))

export const listReviews = async (req, res) =>
  ok(res, await adminCatalogService.listReviewsAdmin(pageable(req)))
export const moderateReview = async (req, res) =>
  ok(res, await adminCatalogService.moderateReviewAdmin(req.params.id, req.body))
export const rejectReview = async (req, res) =>
  ok(res, await adminCatalogService.rejectReviewAdmin(req.params.id))

export const getSalesReport = async (req, res) =>
  ok(res, await adminService.getSalesReport(validatedQuery(req)))
export const getTopProducts = async (req, res) =>
  ok(res, await adminService.getTopProducts(validatedQuery(req)))
