import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Order from "@/lib/models/order"
import Product from "@/lib/models/product"

export async function POST(request) {
  try {
    await dbConnect()

    const { items, user, shippingAddress, paymentMethod, notes } = await request.json()

    // Validate stock and calculate total
    let totalAmount = 0
    const orderItems = []

    for (const item of items) {
      const product = await Product.findById(item.productId)

      if (!product) {
        return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 400 })
      }

      if (product.stock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}` }, { status: 400 })
      }

      const itemTotal = product.price * item.quantity
      totalAmount += itemTotal

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
      })

      // Update stock
      product.stock -= item.quantity
      await product.save()
    }

    // Create order
    const order = new Order({
      user,
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
      notes,
    })

    await order.save()
    await order.populate("items.product")

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error("Error creating order:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    await dbConnect()

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page")) || 1
    const limit = Number.parseInt(searchParams.get("limit")) || 10
    const skip = (page - 1) * limit

    const orders = await Order.find().populate("items.product").skip(skip).limit(limit).sort({ createdAt: -1 })

    const total = await Order.countDocuments()

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching orders:", error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}
