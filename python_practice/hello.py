expression = input("Enter expression (e.g. 2+1, 2*1): ")

try:
    result = eval(expression)
    print("Result:", result)
except Exception as e:
    print("Error:", e)
