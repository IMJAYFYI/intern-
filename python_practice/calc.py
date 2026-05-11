def calc():
        try:
            n = input("enter the expression: ")
            if "+" in n:
                print("add :", eval(n))
            elif "-" in n:
                print("sub :", eval(n))
            elif "*" in n:
                print("multi :", eval(n))
            elif "/" in n:
                print("div :", eval(n))
            else:
                 print(" Error : invalid input")
                 
        except Exception as e:
                print("Error:", e)

calc()


