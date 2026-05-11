from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

products = [
    {"id":1, "name":"vivo", "price":10000},
    {"id":2, "name":"samsung", "price":15000},
    {"id":3, "name":"Xaomi", "price":20000},
    {"id":4, "name":"iphone", "price":150000},
]

class Product(BaseModel):
    id : int
    name : str
    price : float


@app.get("/")
def home():
    return {"message" : "hello im in the homepage"}


@app.get("/products")
def getAllProducts():
    return {"products": products}

@app.get("/products/{product_id}")
def getProductById(product_id: int):
    for product in products:
        if product["id"] == product_id:
            return {"item": product}
    return {"message":"product not found"}



@app.post("/create_product")
def create_product(product: Product):
    products.append(product.model_dump())
    return {
        "message":"product created",
        "all_products" : products
    }

@app.put("/products/{product_id}")
def update_product(product_id: int, updated_product: Product):
    if product_id >= len(products):
        return {"message:":"error! product not found"}
    products[product_id] = updated_product.model_dump()
    return {
        "message":"product added",
        "data" : products[product_id]
    }
@app.delete("/products/{product_id}")
def delete_product(product_id: int):
    for product in products:
        if product["id"] == product_id:
            products.remove(product)
        return {
            "message":"product deleted",
            "data" : product
        }
    return {"message":"product not found"}




