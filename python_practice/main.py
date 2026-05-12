from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI() # creating an instance of the FastAPI class, which will be used to define the API endpoints and handle incoming requests.

# Fake DB
products = [
    {"id":1, "name":"vivo", "price":10000},
    {"id":2, "name":"samsung", "price":15000},
    {"id":3, "name":"Xaomi", "price":20000},
    {"id":4, "name":"iphone", "price":150000},
]
# baseModel for data validation
class Product(BaseModel):
    id : int
    name : str
    price : float

# get request to the homepage
@app.get("/")
def home():
    return {"message" : "hello im in the homepage"}

# get request to the products endpoint, which returns a list of all products in the fake database. The response is a JSON object with a key "products" that contains the list of products.
@app.get("/products")
def getAllProducts():
    return {"products": products}

# get request to fetch a product by its ID. The product_id is passed as a path parameter in the URL. The function iterates through the products list to find a product with the matching ID and returns it. If no product is found, it returns a message indicating that the product was not found.
@app.get("/products/{product_id}")
def getProductById(product_id: int):
    for product in products:
        if product["id"] == product_id:
            return {"item": product}
    return {"message":"product not found"}


# post request to create a new product. The product data is sent in the request body as JSON and is validated against the Product model. If the data is valid, it is added to the products list, and a success message along with the updated list of products is returned.
@app.post("/create_product")
def create_product(product: Product):
    products.append(product.model_dump())
    return {
        "message":"product created",
        "all_products" : products
    }

# put request to update an existing product. The product_id is passed as a path parameter, and the updated product data is sent in the request body. The function checks if the product_id is valid (i.e., within the range of existing products) and updates the corresponding product in the products list. If the product_id is invalid, it returns an error message.
@app.put("/products/{product_id}")
def update_product(product_id: int, updated_product: Product):
    if product_id >= len(products):
        return {"message:":"error! product not found"}
    products[product_id] = updated_product.model_dump()
    return {
        "message":"product added",
        "data" : products[product_id]
    }
# delete request to remove a product by its ID. The function iterates through the products list to find a product with the matching ID and removes it from the list. If the product is found and deleted, it returns a success message along with the deleted product data. If no product is found, it returns a message indicating that the product was not found.
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




